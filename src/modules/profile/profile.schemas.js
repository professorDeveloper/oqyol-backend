import { z } from "zod";

const firstName = z.string().trim().min(1).max(50);
const lastName = z.string().trim().min(1).max(50);
const avatarUrl = z.string().url().nullable().optional();

export const updateMeSchema = z
  .object({
    firstName: firstName.optional(),
    lastName: lastName.optional(),
    avatarUrl: avatarUrl,
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");

export const deleteMeSchema = z.object({
  otpCode: z.string().regex(/^\d{4,8}$/u, "OTP kodi 4–8 raqamdan iborat"),
  reason: z.string().trim().max(500).optional(),
});

export const updateDriverProfileSchema = z
  .object({
    smokingAllowed: z.boolean().optional(),
    acAvailable: z.boolean().optional(),
    musicAllowed: z.boolean().optional(),
    petsAllowed: z.boolean().optional(),
    bio: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");

const userPublicSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(["USER", "DRIVER", "ADMIN"]),
  registeredApp: z.enum(["PASSENGER", "DRIVER"]),
  avatarUrl: z.string().nullable(),
  referralCode: z.string(),
  balance: z.number().nullable(),
  createdAt: z.string().datetime(),
});

const driverProfileSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED"]),
  smokingAllowed: z.boolean(),
  acAvailable: z.boolean(),
  musicAllowed: z.boolean(),
  petsAllowed: z.boolean(),
  bio: z.string().nullable(),
  avgRating: z.number().nullable(),
  totalRatings: z.number().int(),
});

function envelope(data) {
  return z.object({ success: z.literal(true), data });
}

export const meResponseSchema = envelope(userPublicSchema);
export const driverProfileResponseSchema = envelope(driverProfileSchema);
