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


