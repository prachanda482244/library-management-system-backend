import mongoose from "mongoose";
import { cookieOptions } from "../config/constants.js";
import { User } from "../model/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { generateAccessAndRefreshTokens } from "../utils/generateAccessAndRefreshToken.js";
import { sendReminderEmail, sendResetPasswordCode } from "../utils/mailer.js";
import crypto from "crypto";

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if ([username, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All field required");
  }
  const existedUser = await User.findOne({ email });
  if (existedUser) {
    throw new ApiError(409, "User with this email already exist");
  }

  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(404, "Avatar not found");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar) throw new ApiError(404, "Avatar missing");

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    avatar: avatar.url,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) throw new ApiError(400, "Failed to create a user");

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const registerAdmin = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if ([username, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All field required");
  }
  const existedUser = await User.findOne({ email });
  if (existedUser) {
    throw new ApiError(409, "User with this email already exist");
  }

  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(404, "Avatar not found");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar) throw new ApiError(404, "Avatar missing");

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    password,
    role: "admin",
    avatar: avatar.url,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) throw new ApiError(400, "Failed to create a user");

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!(email || password)) throw new ApiError(400, "All field required");

  const existedUser = await User.findOne({ email });
  if (!existedUser) throw new ApiError(404, "User not found");

  const isValidPassword = await existedUser.isPasswordCorrect(password);
  if (!isValidPassword) throw new ApiError(400, "Invalid credentials");

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    existedUser?._id
  );

  const loggedInUser = await User.aggregate([
    {
      $match: {
        _id: existedUser._id,
      },
    },
    {
      $lookup: {
        from: "books",
        localField: "borrowedBooks",
        foreignField: "_id",
        as: "borrowedBooks",
        pipeline: [
          {
            $project: {
              _id: 1,
            },
          },
        ],
      },
    },

    {
      $project: {
        _id: 1,
        username: 1,
        email: 1,
        avatar: 1,
        role: 1,
        fines: 1,
        createdAt: 1,
        borrowedBooks: 1,
      },
    },
  ]);
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, loggedInUser[0], "You have been logged in"));
});

const loggedOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req?.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) throw new ApiError(400, "Password not matched");
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res.status(200).json(new ApiResponse(200, {}, "Password changed"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req?.user._id)
    .populate({
      path: "borrowedBooks",
      select: "-borrowedBy ",
    })
    .select(
      "-password -resetPasswordToken -resetPasswordExpires -refreshToken"
    );

  const currentUser = await User.aggregate([
    {
      $match: {
        _id: req?.user._id,
      },
    },
    {
      $lookup: {
        from: "books",
        localField: "borrowedBooks",
        foreignField: "_id",
        as: "bookBorrowedByUser",
        pipeline: [
          {
            $project: {
              borrowedBy: 0,
              availability: 0,
            },
          },
          {
            $sort: {
              dueDate: -1,
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        username: 1,
        email: 1,
        avatar: 1,
        role: 1,
        fines: 1,
        createdAt: 1,
        bookBorrowedByUser: 1,
      },
    },
  ]);

  if (!user) throw new ApiError(404, "User not found");
  return res
    .status(200)
    .json(new ApiResponse(200, currentUser[0], "User details"));
});
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const user = await User.findById(req?.user?._id);
  let updates = {};

  if (username) {
    updates.username = username;
  }

  if (newPassword) {
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) throw new ApiError(400, "Password not matched");

    updates.password = newPassword;
  }

  if (Object.keys(updates).length > 0) {
    const updatedUser = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: updates },
      { new: true }
    ).select("-password -refreshToken");

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedUser,
          "Account details updated successfully"
        )
      );
  } else {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "No updates provided"));
  }
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  // Todo: remove the image from cloudinary

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) throw new ApiError(404, "user not found");

    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const message = `You requested a password reset. Type this code to reset your password: ${resetToken}`;

    await sendResetPasswordCode({
      email: user.email,
      subject: "Password Reset",
      message,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password reset code"));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken } = req.body;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) throw new ApiError(404, "user not found");

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res
      .status(200)
      .json(new ApiResponse(200, "Password reset successful"));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const getOtherUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId)
    .populate("borrowedBooks")
    .select("-password -refreshToken");
  const otherUser = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "books",
        localField: "borrowedBooks",
        foreignField: "_id",
        as: "borrowedBooksByUser",
        pipeline: [
          {
            $project: {
              borrowedBy: 0,
            },
          },
          {
            $sort: {
              dueDate: -1,
            },
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        username: 1,
        email: 1,
        avatar: 1,
        role: 1,
        fines: 1,
        createdAt: 1,
        borrowedBooksByUser: 1,
      },
    },
  ]);
  if (!user) throw new ApiError(404, "User not found");
  res.status(200).json(new ApiResponse(200, otherUser[0], "User details"));
});
export {
  registerUser,
  loginUser,
  loggedOutUser,
  changePassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  resetPassword,
  forgotPassword,
  registerAdmin,
  getOtherUser,
};
