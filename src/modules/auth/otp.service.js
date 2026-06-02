import crypto from "node:crypto";
import { redis } from "../../clients/redis.js";
import { sendSms } from "../../clients/sms.js";
import { env } from "../../config/env.js";
import { TooManyRequestsError, UnauthorizedError } from "../../shared/errors.js";

const otpKey = (phone) => `otp:${phone}`;
const hourLimitKey = (phone) => `otp_hour:${phone}`;
const cooldownKey = (phone) => `otp_cooldown:${phone}`;
const attemptsKey = (phone) => `otp_attempts:${phone}`;

// Deletion confirmation OTP — alohida namespace (login OTP bilan to'qnashmaslik uchun)
const deletionOtpKey = (phone) => `otp:delete:${phone}`;
const deletionCooldownKey = (phone) => `otp_delete_cooldown:${phone}`;
const deletionHourLimitKey = (phone) => `otp_delete_hour:${phone}`;
const deletionAttemptsKey = (phone) => `otp_delete_attempts:${phone}`;

// Allow-listed demo phone (Play Store review / guest login).
const isDemoPhone = (phone) => env.DEMO_PHONE !== "" && phone === env.DEMO_PHONE;

const SMS_TEMPLATE = (code) =>
  `Kodni hech kimga bermang! Oqyo\`l mobil ilovasi ga kirish uchun tasdiqlash kodi: ${code}`;
// Eskiz har bir SMS matnini moderatsiya qiladi; "delete" uchun alohida template
// hozircha tasdiqlanmagan, shuning uchun umumiy template ishlatamiz —
// foydalanuvchi shu daqiqada o'zi tugmani bosgan, kontekst aniq.
const SMS_TEMPLATE_DELETE = SMS_TEMPLATE;

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
  // Demo phone: never send a real SMS, no rate limits. Code is OTP_DEMO_CODE.
  if (isDemoPhone(phone)) {
    return { expiresInSeconds: env.OTP_TTL_SECONDS, cooldownSeconds: 0 };
  }

  const isProd = env.NODE_ENV === "production";

  if (isProd) {
    await enforceCooldown(phone);
    await enforceHourlyLimit(phone);
  }

  const code = generateCode();
  await redis.set(otpKey(phone), code, "EX", env.OTP_TTL_SECONDS);
  await redis.del(attemptsKey(phone));

  if (isProd) {
    await startCooldown(phone);
  }

  if (!env.OTP_DEMO_MODE) {
    await sendSms(phone, SMS_TEMPLATE(code));
  }

  return {
    expiresInSeconds: env.OTP_TTL_SECONDS,
    cooldownSeconds: isProd ? env.OTP_SEND_COOLDOWN_SECONDS : 0,
  };
}

/**
 * Hisobni o'chirish uchun alohida OTP yuborish.
 * Login OTP bilan bir vaqtda mavjud bo'lishi mumkin (alohida Redis key).
 * Cap: 3/soat (login'dan kamroq — bu kam ishlatiladigan flow).
 */
export async function issueDeletionOtp(phone) {
  const isProd = env.NODE_ENV === "production";

  if (isProd) {
    const ttl = await redis.ttl(deletionCooldownKey(phone));
    if (ttl > 0) {
      throw new TooManyRequestsError(
        `Iltimos, ${ttl} soniya kuting`,
        "OTP_COOLDOWN"
      );
    }
    const count = await redis.incr(deletionHourLimitKey(phone));
    if (count === 1) {
      await redis.expire(deletionHourLimitKey(phone), 3600);
    }
    if (count > 3) {
      throw new TooManyRequestsError(
        "Hisob o'chirish kodlari limiti oshib ketdi (3/soat)",
        "OTP_HOURLY_LIMIT"
      );
    }
  }

  const code = generateCode();
  await redis.set(deletionOtpKey(phone), code, "EX", env.OTP_TTL_SECONDS);
  await redis.del(deletionAttemptsKey(phone));

  if (isProd) {
    await redis.set(deletionCooldownKey(phone), "1", "EX", env.OTP_SEND_COOLDOWN_SECONDS);
  }

  if (!env.OTP_DEMO_MODE) {
    await sendSms(phone, SMS_TEMPLATE_DELETE(code));
  }

  return {
    expiresInSeconds: env.OTP_TTL_SECONDS,
    cooldownSeconds: isProd ? env.OTP_SEND_COOLDOWN_SECONDS : 0,
  };
}

export async function verifyDeletionOtp(phone, code) {
  if (env.OTP_DEMO_MODE && code === env.OTP_DEMO_CODE) {
    await redis.del(deletionOtpKey(phone), deletionAttemptsKey(phone));
    return;
  }

  const stored = await redis.get(deletionOtpKey(phone));
  if (!stored) {
    throw new UnauthorizedError(
      "Tasdiqlash kodi muddati o'tgan yoki so'ralmagan",
      "DELETE_OTP_NOT_FOUND"
    );
  }

  if (stored !== code) {
    const attempts = await redis.incr(deletionAttemptsKey(phone));
    if (attempts === 1) {
      await redis.expire(deletionAttemptsKey(phone), env.OTP_TTL_SECONDS);
    }
    if (attempts >= env.OTP_MAX_VERIFY_ATTEMPTS) {
      await redis.del(deletionOtpKey(phone), deletionAttemptsKey(phone));
      throw new UnauthorizedError(
        "Juda ko'p noto'g'ri urinish. Yangi kod so'rang.",
        "DELETE_OTP_LOCKED"
      );
    }
    throw new UnauthorizedError(
      `Kod noto'g'ri (${env.OTP_MAX_VERIFY_ATTEMPTS - attempts} urinish qoldi)`,
      "DELETE_OTP_INVALID"
    );
  }

  await redis.del(deletionOtpKey(phone), deletionAttemptsKey(phone));
}

export async function verifyOtp(phone, code) {
  if ((env.OTP_DEMO_MODE || isDemoPhone(phone)) && code === env.OTP_DEMO_CODE) {
    await clearOtpState(phone);
    return;
  }

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
