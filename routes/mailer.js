require("dotenv").config();
const SibApiV3Sdk = require("sib-api-v3-sdk");

// Configure API key
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendOTP(email, otp) {
  // Debug logs to verify environment variables
  console.log("=== DEBUG INFO ===");
  console.log("API Key loaded:", !!process.env.BREVO_API_KEY);
  console.log("Sender Name:", process.env.BREVO_FROM_NAME);
  console.log("Sender Email:", process.env.BREVO_FROM_EMAIL);
  console.log("Recipient Email:", email);
  console.log("OTP:", otp);
  console.log("=================");

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
    to: [{ email }],
    sender: { 
      name: process.env.BREVO_FROM_NAME, 
      email: process.env.BREVO_FROM_EMAIL 
    },
    subject: "Your OTP for College Marketplace",
    htmlContent: `<p>Hello, your OTP is: <strong>${otp}</strong>. It is valid for 5 minutes.</p>`,
    textContent: `Hello, your OTP is: ${otp}. It is valid for 5 minutes.`,
  });

  try {
    const response = await tranEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log("✅ OTP sent successfully to:", email);
    console.log("Response:", response);
    return true;
  } catch (error) {
    if (error.response && error.response.body) {
      console.error("❌ Brevo Error:", JSON.stringify(error.response.body, null, 2));
    } else {
      console.error("❌ Unexpected Error:", error);
    }
    return false;
  }
}

module.exports = { sendOTP };
