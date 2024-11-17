import { Book } from "../model/book.model.js";
import { Cart } from "../model/cart.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const addToCart = asyncHandler(async (req, res) => {
  const user = req.user;
  const { bookId } = req.params;
  const book = await Book.findById(bookId);
if(!book) return res.status(200).json(new ApiResponse(200,[],"No items in the cart"))
  let cart = await Cart.findOne({ user: user._id });
  if (!cart) {
    const newCart = await Cart.create({
      user: user._id,
      products: [{ book: bookId, quantity: 1 }],
    });
    return res
      .status(201)
      .json(new ApiResponse(201, newCart, "Book added to cart"));
  }

  const existingBook = cart.books.find(
    ({ book }) => book.toString() === bookId
  );
  if (existingBook) {
    existingBook.quantity += 1;
  } else {
    cart.books.push({ book: bookId, quantity: 1 });
  }
  cart.save();

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Book added to cart"));
});

const getCartDetails = asyncHandler(async (req, res) => {
  const existingCart = await Cart.findOne({ user: req.user.id });

  if (!existingCart) {
    return res.status(200).json(new ApiResponse(200, [], "Your cart details"));
  }
  const cart = await existingCart.populate({
    path: "books.book",
    select: "title coverImage description price",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Your cart fetched successfully"));
});

const updateCart = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { quantity } = req.body;

  if (quantity < 1) throw new ApiError(400, "Quantity must be at least 1");
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id, "books.book": bookId },
    { $set: { "books.$.quantity": quantity } },
    { new: true }
  );

  if (!cart) throw new ApiError(404, "Cart or product not found");
  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Cart Updated Successfully"));
});

const deleteCartItem = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id, "books.book": bookId },
    {
      $pull: { books: { book: bookId } },
    },
    { new: true }
  );

  if (!cart) throw new ApiError(404, "Cart not found");
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Item removed from cart"));
});

const clearCart = asyncHandler(async (req, res) => {
  const cartItem = await Cart.findOne({ user: req.user._id });
  if (!cartItem) {
    throw new ApiError(404, "Cart item not found for this user");
  }
  cartItem.books = [];
  cartItem.save();
  return res
    .status(200)
    .json(new ApiResponse(200, cartItem.products, "Cart was cleared"));
});
export { addToCart, getCartDetails, deleteCartItem, clearCart, updateCart };