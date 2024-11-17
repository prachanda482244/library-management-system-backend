import { Book } from "../model/book.model.js";
import { User } from "../model/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { startOfDay, addDays, format } from "date-fns";
import { sendReminderEmail } from "../utils/mailer.js";

const changeUserRoles = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const { userId } = req.params;

  if (!["member", "librarian"].includes(role)) {
    throw new ApiError(400, "Invalid role provided");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  user.role = role;

  const updatedUser = await user.save();
  if (!updatedUser) throw new ApiError(400, "Failed to update user role");

  res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "User role updated successfully"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .populate({
      path: "borrowedBooks",
      select: "-password -borrowedBy",
    })
    .select(
      "-password -refreshToken -resetPasswordToken -resetPasswordExpires"
    );
  res.status(200).json(new ApiResponse(200, users, "User details"));
});

const getAllBooks = asyncHandler(async (req, res) => {
  const users = await Book.find()
    .populate({
      path: "borrowedBy",
      select: "-password -borrowedBy",
    })
    .select("-password -refreshToken -resetPasswordToken -resetPasswordExpires")
    .sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, users, "User details"));
});

const deleteUser = asyncHandler(async (req, res) => {
  const userCarryBook = await User.findById(req.params.userId);
  if (userCarryBook.borrowedBooks.length) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          [],
          "Failed to remove this user, as this user borrowed book"
        )
      );
  }
  await User.findByIdAndDelete(req.params.userId);
  res.status(200).json(new ApiResponse(200, {}, "User deleted successfully"));
});
const getStatistics = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalBooks = await Book.countDocuments();
  const borrowedBooks = await Book.countDocuments({ availability: false });
  const availableBooks = await Book.countDocuments({ availability: true });

  const booksByCategory = await Book.aggregate([
    { $group: { _id: "$genre", count: { $sum: 1 } } },
  ]);

  const usersByMonth = await User.aggregate([
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalUsers,
        totalBooks,
        borrowedBooks,
        availableBooks,
        booksByCategory,
        usersByMonth,
      },
      "System statistics"
    )
  );
});

const getRequestApproval =asyncHandler(async(req,res)=>{
  const {bookId,status} = req.body

   const book = await Book.findById(bookId)
 if(!book) return res.status(200).json(new ApiResponse(200,{},"No book found"))
  book.borrowApprovalStatus=status
book.save()
return res.status(200).json(new ApiResponse(200,book,`Book status updated to ${status}`))

})

const checkDueDatesAndSendReminders = asyncHandler(async (req, res) => {
  const reminderDate = startOfDay(addDays(new Date(), 2));

  console.log(reminderDate);
  const booksDueSoon = await Book.find({
    dueDate: {
      $gte: reminderDate,
      $lt: addDays(reminderDate, 1),
    },
  });
  console.log(booksDueSoon);

  if (!booksDueSoon.length) {
    return res
      .status(404)
      .json(new ApiResponse(404, {}, "No books due in 2 days."));
  }

  for (const book of booksDueSoon) {
    const user = await User.findById(book.borrowedBy);

    if (user) {
      await sendReminderEmail({
        email: user.email,
        bookTitle: book.title,
        dueDate: format(book.dueDate, "yyyy-MM-dd"),
      });
    }
  }

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Reminder emails sent successfully."));
});

export {
  changeUserRoles,
  deleteUser,
  getStatistics,
  getAllUsers,
  getAllBooks,
  checkDueDatesAndSendReminders,
  getRequestApproval
};
