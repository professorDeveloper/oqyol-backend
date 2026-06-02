import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

const uuid = z.string().uuid();

export const createAnnouncementSchema = z.object({
  routeId: uuid,
  departureTime: z.coerce.date().refine((d) => d.getTime() > Date.now(), "departureTime must be in the future"),
  availableSeats: z.coerce.number().int().min(1).max(8),
  pricePerSeat: z.coerce.number().positive().max(100_000_000),
  note: z.string().trim().max(300).optional(),
});

export const updateAnnouncementSchema = z
  .object({
    departureTime: z.coerce
      .date()
      .refine((d) => d.getTime() > Date.now(), "departureTime must be in the future")
      .optional(),
    availableSeats: z.coerce.number().int().min(1).max(8).optional(),
    pricePerSeat: z.coerce.number().positive().max(100_000_000).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field");

export const announcementIdParamSchema = z.object({ id: uuid });

export const feedQuerySchema = paginationQuerySchema.extend({
  routeId: uuid.optional(),
  fromRegionId: uuid.optional(),
  toRegionId: uuid.optional(),
});

export const myQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
});
