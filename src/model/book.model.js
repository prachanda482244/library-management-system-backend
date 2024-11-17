import { Schema, model } from "mongoose";
const bookSchema = new Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    description: { type: String, required: true },
    genre: { type: String, required: true },
    publicationYear: { type: Number, required: true },
    isbn: { type: String, required: true, unique: true },
    availability: { type: Boolean, default: true },
    price:{type:Number,default:0},
    coverImage: { type: String },
    borrowedAt: { type: Date, default: null },
    borrowedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    dueDate: { type: Date, default: null },
    borrowApprovalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
}, {
    timestamps: true
});

export const Book = model("Book", bookSchema);