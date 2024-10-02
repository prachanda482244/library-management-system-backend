import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import {
  changePassword,
  forgotPassword,
  getCurrentUser,
  getOtherUser,
  loggedOutUser,
  loginUser,
  registerUser,
  resetPassword,
  updateAccountDetails,
  updateUserAvatar,
} from "../controller/user.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(upload.single("avatar"), registerUser);
userRouter.route("/login").post(loginUser);
userRouter.route("/current-user").get(verifyJwt, getCurrentUser);
userRouter.route("/logout").post(loggedOutUser);
userRouter.route("/change-password").post(verifyJwt, changePassword);
userRouter
  .route("/update-account-details")
  .patch(verifyJwt, updateAccountDetails);
userRouter
  .route("/avatar-update")
  .patch(verifyJwt, upload.single("avatar"), updateUserAvatar);
userRouter.route("/forgot-password").post(forgotPassword);
userRouter.route("/get-other-user/:userId").get(getOtherUser);
userRouter.route("/reset-password").post(resetPassword);
export default userRouter;
