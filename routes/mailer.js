require("dotenv").config();
const SibApiV3Sdk = require("sib-api-v3-sdk");

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

async function sendOTP(email, otp) {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
    to: [{ email }],
    sender: { name: process.env.BREVO_FROM_NAME, email: process.env.BREVO_FROM_EMAIL },
    subject: "Your OTP for College Marketplace",
    htmlContent: `<p>Hello, your OTP is: <strong>${otp}</strong>. It is valid for 5 minutes.</p>`,
    textContent: `Hello, your OTP is: ${otp}. It is valid for 5 minutes.`,
  });

  try {
    await tranEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log("✅ OTP sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Error sending OTP:", error.response?.body || error);
    return false;
  }
}

module.exports = { sendOTP };
