// mailer.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail", // using Gmail SMTP
  auth: {
    user: process.env.EMAIL_USER, // your gmail address
    pass: process.env.EMAIL_PASS, // your gmail app password
  },
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Mailer error:", error);
  } else {
    console.log("✅ Mailer ready to send emails");
  }
});

// Function to send OTP
async function sendOTP(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP for College Marketplace",
    text: `Hello, your OTP is: ${otp}. It is valid for 5 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ OTP sent to:", email);
    return true;
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    return false;
  }
}

module.exports = { sendOTP };
