// mailer.js
const fetch = require("node-fetch"); // not needed if using Node 18+
require("dotenv").config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL; // verified sender email

// ✅ Keep same function signature
async function sendOTP(email, otp) {
  const mailData = {
    from: RESEND_FROM,
    to: email,
    subject: "Your OTP for College Marketplace",
    html: `<p>Hello, your OTP is: <strong>${otp}</strong>. It is valid for 5 minutes.</p>`,
  };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mailData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Failed to send OTP:", data);
      return false;
    }

    console.log("✅ OTP sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Error sending OTP:", error);
    return false;
  }
}

module.exports = { sendOTP };
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
