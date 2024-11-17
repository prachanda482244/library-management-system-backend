import { Schema, model } from "mongoose";
const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    books: [
      {
        book: {
          type: Schema.Types.ObjectId,
          ref: "Book",
        },
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
    totalAmount: {
      type: Number,
    },
  },
  { timestamps: true }
);

export const Cart = model("Cart", cartSchema);