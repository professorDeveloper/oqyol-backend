import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

const uuid = z.string().uuid();

const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const addressText = z.string().trim().min(2).max(300);

export const createOrderSchema = z.object({
  // routeId ixtiyoriy. Agar berilsa — backend basePrice asosida 0.3x–5x narx
  // tekshiruvi qiladi. Agar berilmasa — fromRegionId+toRegionId majburiy va
  // narx faqat zod min/max chegarasi ichida bo'lishi yetadi (passenger erkin
  // belgilaydi).
  routeId: uuid.optional(),
  fromRegionId: uuid.optional(),
  toRegionId: uuid.optional(),
  passengerPrice: z.coerce
    .number()
    .positive()
    .min(1000)
    .max(100_000_000)
    .describe("Yo'lovchi taklif qilayotgan narx (so'm). Route bo'lsa 0.3x–5x basePrice oralig'ida; aks holda 1 000 – 100 000 000 oralig'ida."),
  seatsRequested: z.coerce.number().int().min(1).max(4).default(1),
  rideType: z.enum(["SOLO", "CARPOOL"]).default("SOLO"),
  scheduledAt: z.coerce.date().optional(),
  pickupLat: lat.optional(),
  pickupLng: lng.optional(),
  pickupAddress: addressText.optional(),
  dropoffLat: lat.optional(),
  dropoffLng: lng.optional(),
  dropoffAddress: addressText.optional(),
})
  .refine(
    (v) => v.routeId != null || (v.fromRegionId != null && v.toRegionId != null),
    {
      message: "routeId yoki (fromRegionId + toRegionId) yuborilishi kerak",
      path: ["routeId"],
    }
  )
  .refine(
    (v) =>
      (v.pickupLat == null && v.pickupLng == null) ||
      (v.pickupLat != null && v.pickupLng != null),
    { message: "pickupLat va pickupLng birga yuborilishi kerak", path: ["pickupLng"] }
  )
  .refine(
    (v) =>
      (v.dropoffLat == null && v.dropoffLng == null) ||
      (v.dropoffLat != null && v.dropoffLng != null),
    { message: "dropoffLat va dropoffLng birga yuborilishi kerak", path: ["dropoffLng"] }
  );

export const orderIdParamSchema = z.object({ id: uuid });

const ORDER_STATUSES = ["OPEN", "ACCEPTED", "ARRIVED", "FOUND", "CANCELLED", "EXPIRED", "DISPUTED"];
const orderStatusEnum = z.enum(ORDER_STATUSES);

// Mobil bir nechta statusni filterlash uchun CSV yuboradi (?status=OPEN,ACCEPTED,ARRIVED,FOUND).
// Bitta status ham, undefined ham qo'llab-quvvatlanadi.
const statusListSchema = z.preprocess(
  (v) => {
    if (v == null) return undefined;
    if (Array.isArray(v)) return v;
    const s = String(v).trim();
    if (!s) return undefined;
    const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
    return parts.length ? parts : undefined;
  },
  z.array(orderStatusEnum).min(1).optional()
);

export const passengerOrderListQuerySchema = paginationQuerySchema.extend({
  status: statusListSchema,
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
  pickup: z
    .object({ lat: z.number(), lng: z.number(), address: z.string().nullable() })
    .nullable(),
  dropoff: z
    .object({ lat: z.number(), lng: z.number(), address: z.string().nullable() })
    .nullable(),
  scheduledAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const orderResponseSchema = envelope(orderSchema);
