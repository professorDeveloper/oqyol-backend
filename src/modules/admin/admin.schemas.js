import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

export const userListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["USER", "DRIVER", "ADMIN"]).optional(),
  registeredApp: z.enum(["PASSENGER", "DRIVER"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const userIdParamSchema = z.object({ id: z.string().uuid() });

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(["USER", "DRIVER", "ADMIN"]).optional(),
    isActive: z.boolean().optional(),
    firstName: z.string().trim().min(1).max(50).optional(),
    lastName: z.string().trim().min(1).max(50).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field");

export const adminUpdateDriverSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED"]).optional(),
    suspendedUntil: z.coerce.date().nullable().optional(),
    bio: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field");

const userListItemSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(["USER", "DRIVER", "ADMIN"]),
  registeredApp: z.enum(["PASSENGER", "DRIVER"]),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

function envelope(d) {
  return z.object({ success: z.literal(true), data: d });
}

export const userListResponseSchema = envelope(
  z.object({
    items: z.array(userListItemSchema),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
);

export const userDetailResponseSchema = envelope(userListItemSchema);
