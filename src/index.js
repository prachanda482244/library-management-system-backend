import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server } from "socket.io"; // Import Socket.IO
import { createServer } from "http";
import { PORT } from "./config/constants.js";
import connectToDb from "./db/connect.js";
import userRouter from "./routes/user.route.js";
import bookRouter from "./routes/book.route.js";
import adminRouter from "./routes/admin.route.js";
import borrowRouter from "./routes/borrow.route.js";
import scheduleReminders from "./utils/scheduleReminder.js";
import notificationRouter from "./routes/notification.route.js";
import searchRouter from "./routes/search.route.js";
import { initializeSocketIO } from "./socket/socket.js";
import chatRouter from "./routes/chat.route.js";
import chatMessageRouter from "./routes/chatmessage.route.js";
import recommendRouter from "./routes/recommended.route.js";
import reviewRouter from "./routes/review.route.js";
import cartRouter from "./routes/cart.route.js";
import orderRouter from "./routes/order.route.js";

const app = express();
connectToDb();

// Middleware setup
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
scheduleReminders();
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
app.use(urlencoded({ extended: true, limit: "20mb" }));
app.use(express.static("public"));

// Routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/books", bookRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/borrow", borrowRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/search", searchRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/recommendation", recommendRouter);
// chat Router
app.use("/api/v1/chats", chatRouter);
app.use("/api/v1/chat/messages", chatMessageRouter);


app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/order", orderRouter);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

app.set("io", io);
initializeSocketIO(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
