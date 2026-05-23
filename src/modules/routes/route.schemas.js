import { z } from "zod";

const uuid = z.string().uuid();
const distanceKm = z.coerce.number().positive().max(10000);
const estimatedDurationMin = z.coerce.number().int().positive().max(10000);
const basePrice = z.coerce.number().nonnegative().max(100_000_000);

export const createRouteSchema = z.object({
  fromRegionId: uuid,
  toRegionId: uuid,
  distanceKm,
  estimatedDurationMin,
  basePrice,
  isActive: z.boolean().optional(),
});

export const updateRouteSchema = z
  .object({
    fromRegionId: uuid.optional(),
    toRegionId: uuid.optional(),
    distanceKm: distanceKm.optional(),
    estimatedDurationMin: estimatedDurationMin.optional(),
    basePrice: basePrice.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field");

export const routeIdParamSchema = z.object({ id: uuid });

export const routeQuerySchema = z.object({
  fromRegionId: uuid.optional(),
  toRegionId: uuid.optional(),
});

const routeSchema = z.object({
  id: uuid,
  fromRegionId: uuid,
  toRegionId: uuid,
  distanceKm: z.number(),
  estimatedDurationMin: z.number().int(),
  basePrice: z.number(),
  isActive: z.boolean(),
  fromRegion: z.object({ id: uuid, name: z.string() }).optional(),
  toRegion: z.object({ id: uuid, name: z.string() }).optional(),
});

function envelope(d) {
  return z.object({ success: z.literal(true), data: d });
}
export const routeResponseSchema = envelope(routeSchema);
export const routeListResponseSchema = envelope(z.array(routeSchema));
