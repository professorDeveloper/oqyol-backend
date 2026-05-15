import { z } from "zod";

const phone = z
  .string()
  .trim()
  .regex(/^\+998\d{9}$/u, "Phone must be in +998XXXXXXXXX format")
  .describe("Uzbekistan phone number");

const otpCode = z
  .string()
  .regex(/^\d{4,8}$/u, "OTP code must be 4-8 digits")
  .describe("Numeric OTP code received via SMS");

const deviceId = z.string().trim().min(1).max(128).describe("Stable unique device identifier");
const deviceName = z.string().trim().min(1).max(128).describe("Human-readable device name");

export const appType = z.enum(["PASSENGER", "DRIVER"]).describe("Which app the client is — PASSENGER or DRIVER");

// ─── Request schemas ───────────────────────────────────────────────────────

export const sendOtpSchema = z.object({ phone });

export const verifyOtpSchema = z.object({
  phone,
  code: otpCode,
  deviceId,
  deviceName,
  appType,
});

export const completeRegisterSchema = z.object({
  registerToken: z.string().min(1).describe("Short-lived token returned from verify-otp when user is new"),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  referralCode: z.string().trim().min(4).max(16).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  sessionId: z.string().uuid().optional().describe("Session to terminate. Defaults to current session."),
});

export const sessionIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ─── Response building blocks ──────────────────────────────────────────────

export const userPublicSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(["USER", "DRIVER", "ADMIN"]),
  registeredApp: appType,
  avatarUrl: z.string().nullable(),
  referralCode: z.string(),
});

export const sessionSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string(),
  deviceName: z.string(),
  lastActiveAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

function envelope(dataSchema) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

// ─── Per-endpoint response schemas ─────────────────────────────────────────

export const sendOtpResponseSchema = envelope(
  z.object({
    message: z.string(),
    expiresInSeconds: z.number().int().positive(),
    cooldownSeconds: z.number().int().positive(),
  })
);

export const verifyOtpAuthenticatedResponseSchema = envelope(
  z.object({
    status: z.literal("AUTHENTICATED"),
    accessToken: z.string(),
    refreshToken: z.string(),
    user: userPublicSchema,
  })
);

export const verifyOtpDriverPendingResponseSchema = envelope(
  z.object({
    status: z.literal("DRIVER_APPROVAL_PENDING"),
    accessToken: z.string(),
    refreshToken: z.string(),
    user: userPublicSchema,
  })
);

export const verifyOtpRegistrationRequiredResponseSchema = envelope(
  z.object({
    status: z.literal("REGISTRATION_REQUIRED"),
    registerToken: z.string(),
  })
);

export const completeRegisterAuthenticatedResponseSchema = envelope(
  z.object({
    status: z.literal("AUTHENTICATED"),
    accessToken: z.string(),
    refreshToken: z.string(),
    user: userPublicSchema,
  })
);

export const completeRegisterDriverPendingResponseSchema = envelope(
  z.object({
    status: z.literal("DRIVER_APPROVAL_PENDING"),
    accessToken: z.string(),
    refreshToken: z.string(),
    user: userPublicSchema,
  })
);

export const refreshResponseSchema = envelope(
  z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
);

export const messageResponseSchema = envelope(z.object({ message: z.string() }));

export const sessionListResponseSchema = envelope(z.array(sessionSchema));

// ─── Error response ────────────────────────────────────────────────────────

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string(),
  statusCode: z.number().int(),
});
