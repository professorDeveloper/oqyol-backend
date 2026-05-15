import crypto from "node:crypto";
import { redis } from "../../clients/redis.js";
import { sendSms } from "../../clients/sms.js";
import { env } from "../../config/env.js";
import { TooManyRequestsError, UnauthorizedError } from "../../shared/errors.js";

const otpKey = (phone) => `otp:${phone}`;
const hourLimitKey = (phone) => `otp_hour:${phone}`;
const cooldownKey = (phone) => `otp_cooldown:${phone}`;
const attemptsKey = (phone) => `otp_attempts:${phone}`;
const SMS_TEMPLATE = (code) => `Tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`;

function generateCode() {
  if (env.OTP_DEMO_MODE) return env.OTP_DEMO_CODE;
  const min = 10 ** (env.OTP_LENGTH - 1);
  const max = 10 ** env.OTP_LENGTH;
  return String(crypto.randomInt(min, max));
}

async function enforceCooldown(phone) {
  const ttl = await redis.ttl(cooldownKey(phone));
  if (ttl > 0) {
    throw new TooManyRequestsError(
      `Please wait ${ttl}s before requesting another OTP`,
      "OTP_COOLDOWN"
    );
  }
}

async function enforceHourlyLimit(phone) {
  const key = hourLimitKey(phone);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 3600);
  }
  if (count > env.OTP_SEND_LIMIT_PER_HOUR) {
    throw new TooManyRequestsError(
      "Hourly OTP limit reached, try again later",
      "OTP_HOURLY_LIMIT"
    );
  }
}

async function startCooldown(phone) {
  await redis.set(cooldownKey(phone), "1", "EX", env.OTP_SEND_COOLDOWN_SECONDS);
}

async function clearOtpState(phone) {
  await redis.del(otpKey(phone), attemptsKey(phone));
}

export async function issueOtp(phone) {
  await enforceCooldown(phone);
  await enforceHourlyLimit(phone);

  const code = generateCode();
  await redis.set(otpKey(phone), code, "EX", env.OTP_TTL_SECONDS);
  await redis.del(attemptsKey(phone));
  await startCooldown(phone);

  await sendSms(phone, SMS_TEMPLATE(code));

  return {
    expiresInSeconds: env.OTP_TTL_SECONDS,
    cooldownSeconds: env.OTP_SEND_COOLDOWN_SECONDS,
  };
}

export async function verifyOtp(phone, code) {
  const stored = await redis.get(otpKey(phone));
  if (!stored) {
    throw new UnauthorizedError("OTP expired or not requested", "OTP_NOT_FOUND");
  }

  if (stored !== code) {
    const attempts = await redis.incr(attemptsKey(phone));
    if (attempts === 1) {
      await redis.expire(attemptsKey(phone), env.OTP_TTL_SECONDS);
    }
    if (attempts >= env.OTP_MAX_VERIFY_ATTEMPTS) {
      await clearOtpState(phone);
      throw new UnauthorizedError(
        "Too many wrong attempts, request a new OTP",
        "OTP_LOCKED"
      );
    }
    throw new UnauthorizedError(
      `Invalid OTP (${env.OTP_MAX_VERIFY_ATTEMPTS - attempts} attempts left)`,
      "OTP_INVALID"
    );
  }

  await clearOtpState(phone);
}
