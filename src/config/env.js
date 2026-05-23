import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REGISTER_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),
  JWT_REGISTER_EXPIRY: z.string().default("10m"),

  ESKIZ_EMAIL: z.string().default(""),
  ESKIZ_PASSWORD: z.string().default(""),
  ESKIZ_FROM: z.string().default("4546"),

  OTP_DEMO_MODE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  OTP_DEMO_CODE: z.string().default("123456"),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  OTP_SEND_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(3),
  OTP_SEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_VERIFY_ATTEMPTS: z.coerce.number().int().positive().default(5),

  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.1),
  ORDER_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  OFFER_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  ARRIVAL_RADIUS_METERS: z.coerce.number().int().positive().default(150),

  CORS_ORIGINS: z.string().default("*"),

  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default(""),
  R2_PUBLIC_URL: z.string().default(""),
  R2_ENDPOINT: z.string().default(""),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const data = parsed.data;
if (!data.JWT_REGISTER_SECRET) {
  data.JWT_REGISTER_SECRET = data.JWT_ACCESS_SECRET + ":register";
}

export const env = Object.freeze(data);
