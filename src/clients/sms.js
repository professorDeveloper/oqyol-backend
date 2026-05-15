import axios from "axios";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

const ESKIZ_LOGIN_URL = "https://notify.eskiz.uz/api/auth/login";
const ESKIZ_SEND_URL = "https://notify.eskiz.uz/api/message/sms/send";

let cachedToken = "";
let tokenRefreshedAt = 0;
const TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;

async function fetchToken() {
  const res = await axios.post(ESKIZ_LOGIN_URL, {
    email: env.ESKIZ_EMAIL,
    password: env.ESKIZ_PASSWORD,
  });
  cachedToken = res.data.data.token;
  tokenRefreshedAt = Date.now();
  return cachedToken;
}

async function getToken() {
  if (cachedToken && Date.now() - tokenRefreshedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }
  return fetchToken();
}

function invalidateToken() {
  cachedToken = "";
  tokenRefreshedAt = 0;
}

export async function sendSms(phone, message) {
  if (env.OTP_DEMO_MODE) {
    logger.info("sms (demo)", { phone, message });
    return;
  }

  const normalizedPhone = phone.replace(/^\+/, "");
  const token = await getToken();

  try {
    await axios.post(
      ESKIZ_SEND_URL,
      { mobile_phone: normalizedPhone, message, from: env.ESKIZ_FROM },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    if (err.response?.data?.message === "token_invalid") {
      invalidateToken();
      const fresh = await getToken();
      await axios.post(
        ESKIZ_SEND_URL,
        { mobile_phone: normalizedPhone, message, from: env.ESKIZ_FROM },
        { headers: { Authorization: `Bearer ${fresh}` } }
      );
      return;
    }
    throw err;
  }
}
