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
  logger.info("eskiz: token refreshed");
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

async function postSms(token, payload) {
  return axios.post(ESKIZ_SEND_URL, payload, {
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });
}

export async function sendSms(phone, message) {
  if (env.OTP_DEMO_MODE) {
    logger.info("sms (demo)", { phone, message });
    return;
  }

  const normalizedPhone = phone.replace(/^\+/, "");
  const payload = { mobile_phone: normalizedPhone, message, from: env.ESKIZ_FROM };

  let token = await getToken();
  let res = await postSms(token, payload);

  if (res.data?.message === "token_invalid" || res.status === 401) {
    invalidateToken();
    token = await getToken();
    res = await postSms(token, payload);
  }

  if (res.status >= 200 && res.status < 300) {
    logger.info("eskiz: sms accepted", {
      phone: normalizedPhone,
      from: env.ESKIZ_FROM,
      status: res.status,
      eskizStatus: res.data?.status,
      messageId: res.data?.id,
      data: res.data,
    });
    return res.data;
  }

  logger.error("eskiz: sms send failed", {
    phone: normalizedPhone,
    from: env.ESKIZ_FROM,
    status: res.status,
    body: res.data,
  });
  const err = new Error(
    `Eskiz SMS failed: status=${res.status} body=${JSON.stringify(res.data)}`
  );
  err.eskizStatus = res.status;
  err.eskizBody = res.data;
  throw err;
}
