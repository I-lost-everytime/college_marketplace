require("dotenv").config();
const { Resend } = require("resend");

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOTP(email, otp) {
  console.log("=== DEBUG INFO ===");
  console.log("API Key loaded:", !!process.env.RESEND_API_KEY);
  console.log("Sender Email:", process.env.RESEND_FROM_EMAIL);
  console.log("Recipient Email:", email);
  console.log("OTP:", otp);
  console.log("=================");

  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL, // e.g. "College Marketplace <onboarding@resend.dev>"
      to: email,
      subject: "Your OTP for College Marketplace",
      html: `<p>Hello, your OTP is: <strong>${otp}</strong>. It is valid for 5 minutes.</p>`,
      text: `Hello, your OTP is: ${otp}. It is valid for 5 minutes.`,
    });

    console.log("✅ OTP sent successfully to:", email);
    console.log("Response:", response);
    return true;
  } catch (error) {
    console.error("❌ Resend Error:", error);
    return false;
  }
}

module.exports = { sendOTP };
