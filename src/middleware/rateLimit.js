import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

function makeMessage(error) {
  return { success: false, error, code: "TOO_MANY_REQUESTS", statusCode: 429 };
}

const skipInNonProd = () => env.NODE_ENV !== "production";

export const globalLimiter = rateLimit({
  windowMs: env.THROTTLE_TTL * 1000,
  max: env.THROTTLE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: makeMessage("Too many requests"),
  skip: skipInNonProd,
});

export const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: makeMessage("Wait before requesting another OTP"),
  skip: skipInNonProd,
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: makeMessage("Too many OTP verification attempts"),
  skip: skipInNonProd,
});
