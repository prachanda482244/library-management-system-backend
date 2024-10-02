import mongoose from "mongoose";
import { Review } from "../model/review.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const postReview = asyncHandler(async (req, res) => {
  const { bookId, content, parentReviewId } = req.body;

  if (![bookId, content].every((field) => field && field !== "")) {
    throw new ApiError(400, "Book ID, user ID, and content are required");
  }

  const reviewData = { bookId, userId: req.user._id, content };
  if (parentReviewId) {
    reviewData.parentReviewId = parentReviewId;
  }

  const review = await Review.create(reviewData);

  if (review) {
    if (parentReviewId) {
      const parentReview = await Review.findById(parentReviewId);
      if (!parentReview) {
        throw new ApiError(404, "Parent review not found");
      }
      parentReview.replies.push(review._id);
      await parentReview.save();
    }

    res
      .status(200)
      .json(new ApiResponse(200, review, "Review added successfully"));
  }
});

const getReviewsForBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { page = 1, limit = 6 } = req.query;

  try {
    const totalCount = await Review.countDocuments({
      bookId,
      parentReviewId: null,
    });

    if (totalCount === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No reviews found for this book"));
    }

    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;

    const reviews = await Review.aggregate([
      {
        $match: {
          bookId: new mongoose.Types.ObjectId(bookId),
          parentReviewId: null,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $graphLookup: {
          from: "reviews",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentReviewId",
          as: "allReplies",
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          createdAt: 1,
          updatedAt: 1,
          userId: {
            username: "$user.username",
            avatar: "$user.avatar",
            _id: "$user._id",
          },
          hasReplies: {
            $gt: [{ $size: { $ifNull: ["$replies", []] } }, 0],
          },
          replyCount: { $size: { $ifNull: ["$allReplies", []] } },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    const totalReviews = await Review.aggregate([
      {
        $match: {
          bookId: new mongoose.Types.ObjectId(bookId),
        },
      },
      {
        $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "parentReviewId",
          as: "replies",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $add: [1, { $size: "$replies" }],
            },
          },
        },
      },
    ]);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          reviews,
          totalCount: totalReviews.length ? totalReviews[0].total : 0,
          totalPages,
          currentPage: page,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        "Reviews fetched successfully"
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, "Error fetching reviews", error));
  }
});
const getNestedReplies = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  try {
    const review = await Review.findById(reviewId).lean();

    if (!review) {
      return res.status(404).json(new ApiError(404, "Review not found"));
    }

    const replies = await Review.aggregate([
      {
        $match: {
          parentReviewId: new mongoose.Types.ObjectId(reviewId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $graphLookup: {
          from: "reviews",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentReviewId",
          as: "allReplies",
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          createdAt: 1,
          updatedAt: 1,
          userId: {
            username: "$user.username",
            avatar: "$user.avatar",
            _id: "$user._id",
          },
          hasReplies: {
            $gt: [{ $size: { $ifNull: ["$replies", []] } }, 0],
          },
          replyCount: { $size: { $ifNull: ["$allReplies", []] } },
        },
      },
    ]);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          replies,
        },
        "Nested replies fetched successfully"
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, "Error fetching nested replies", error));
  }
});

const editReview = asyncHandler(async (req, res) => {
  const { content, reviewId } = req.body;

  if (!reviewId) throw new ApiError(404, "Review id not found");
  if (!content || content.trim() === "") {
    throw new ApiError(400, "Content is required to edit the review");
  }

  const review = await Review.findOneAndUpdate(
    { _id: reviewId, userId: req.user._id },
    { content },
    { new: true }
  );

  if (!review) {
    throw new ApiError(404, "Review not found or user unauthorized");
  }

  res
    .status(200)
    .json(new ApiResponse(200, review, "Review updated successfully"));
});

const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.body;
  if (!reviewId) throw new ApiError(404, "Review id not found");

  const review = await Review.findOneAndDelete({
    _id: reviewId,
    userId: req.user._id,
  });

  if (!review) {
    throw new ApiError(404, "Review not found or user unauthorized");
  }

  if (review.parentReviewId) {
    await Review.findByIdAndUpdate(review.parentReviewId, {
      $pull: { replies: reviewId },
    });
  }

  await Review.deleteMany({ parentReviewId: review._id });

  res
    .status(200)
    .json(
      new ApiResponse(200, null, "Review and its replies deleted successfully")
    );
});

export {
  postReview,
  getReviewsForBook,
  editReview,
  deleteReview,
  getNestedReplies,
};

// const review = await Review.aggregate([
//   {
//     $match: { _id: new mongoose.Types.ObjectId(reviewId) },
//   },
//   {
//     $lookup: {
//       from: "users", // Lookup user details for the review's user
//       localField: "userId",
//       foreignField: "_id",
//       as: "user",
//     },
//   },
//   {
//     $unwind: { path: "$user", preserveNullAndEmptyArrays: true },
//   },
//   {
//     $lookup: {
//       from: "reviews", // Lookup for the replies
//       localField: "replies",
//       foreignField: "_id",
//       as: "repliesDetails",
//     },
//   },
//   {
//     $addFields: {
//       hasReplies: { $gt: [{ $size: { $ifNull: ["$repliesDetails", []] } }, 0] },
//     },
//   },
//   {
//     $project: {
//       _id: 1,
//       content: 1,
//       createdAt: 1,
//       updatedAt: 1,
//       userId: {
//         username: "$user.username",
//         avatar: "$user.avatar",
//         _id: "$user._id",
//       },
//       replies: "$repliesDetails", // Include replies in the projection
//       hasReplies: 1,
//     },
//   },
// ]);

// // Now `review` contains the structured response with replies included
