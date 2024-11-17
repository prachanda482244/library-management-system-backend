import { Router } from "express";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import { addToCart, clearCart, deleteCartItem, getCartDetails, updateCart } from "../controller/cart.controller.js";
const cartRouter = Router();

cartRouter.use(verifyJwt);

cartRouter.route("/").get(getCartDetails);
cartRouter.route("/add-to-cart/:bookId").post(addToCart);
cartRouter.route("/delete-cart/:bookId").delete(deleteCartItem);
cartRouter.route("/clear-cart").delete(clearCart);
cartRouter.route("/update-cart/:bookId").put(updateCart);
export default cartRouter;