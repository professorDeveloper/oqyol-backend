import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

const uuid = z.string().uuid();

export const createOrderSchema = z.object({
  routeId: uuid,
  passengerPrice: z.coerce
    .number()
    .positive()
    .max(100_000_000)
    .describe("Yo'lovchi taklif qilayotgan narx (so'm). 0.3x–5x basePrice oralig'ida bo'lishi shart."),
  seatsRequested: z.coerce.number().int().min(1).max(4).default(1),
  rideType: z.enum(["SOLO", "CARPOOL"]).default("SOLO"),
  scheduledAt: z.coerce.date().optional(),
});

export const orderIdParamSchema = z.object({ id: uuid });

export const passengerOrderListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["OPEN", "ACCEPTED", "ARRIVED", "FOUND", "CANCELLED", "EXPIRED", "DISPUTED"]).optional(),
});

export const openOrdersQuerySchema = paginationQuerySchema.extend({
  fromRegionId: uuid.optional(),
  toRegionId: uuid.optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(200),
});

export const arriveSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().nonnegative().default(0),
});

export const foundSchema = z.object({
  otpCode: z.string().regex(/^\d{4,8}$/u, "OTP code must be 4-8 digits"),
});

export const createOfferSchema = z.object({
  orderId: uuid,
  offeredPrice: z.coerce.number().positive().max(100_000_000),
  message: z.string().trim().max(200).optional(),
});

export const offerIdParamSchema = z.object({ id: uuid });

function envelope(d) {
  return z.object({ success: z.literal(true), data: d });
}

const orderSchema = z.object({
  id: uuid,
  status: z.enum(["OPEN", "ACCEPTED", "ARRIVED", "FOUND", "CANCELLED", "EXPIRED", "DISPUTED"]),
  rideType: z.enum(["SOLO", "CARPOOL"]),
  seatsRequested: z.number().int(),
  passengerPrice: z.number(),
  finalPrice: z.number().nullable(),
  scheduledAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const orderResponseSchema = envelope(orderSchema);
