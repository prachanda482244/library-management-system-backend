import nodemailer from "nodemailer";

const sendReminderEmail = async ({ email, bookTitle, dueDate }) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Reminder: Book "${bookTitle}" is due soon`,
    text: `Dear User,

This is a reminder that your borrowed book "${bookTitle}" is due on ${dueDate}.

Please return the book by the due date to avoid any late fees.

Thank you for using our library system.

Best regards,
Library Management System Team`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reminder email sent successfully to ${email}`);
  } catch (error) {
    console.error(`Error sending reminder email to ${email}:`, error);
    throw new Error("Could not send reminder email");
  }
};

const sendResetPasswordCode = async ({ email, subject, message }) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject,
    text: message,
  };

  await transporter.sendMail(mailOptions);
};

export { sendReminderEmail, sendResetPasswordCode };
