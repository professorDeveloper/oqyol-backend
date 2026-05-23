import { z } from "zod";

const name = z.string().trim().min(1).max(100);
const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const radiusKm = z.coerce.number().positive().max(500);

export const createRegionSchema = z.object({
  name,
  lat,
  lng,
  radiusKm,
  isActive: z.boolean().optional(),
});

export const updateRegionSchema = z
  .object({
    name: name.optional(),
    lat: lat.optional(),
    lng: lng.optional(),
    radiusKm: radiusKm.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field");

export const regionIdParamSchema = z.object({ id: z.string().uuid() });

const regionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  radiusKm: z.number(),
  isActive: z.boolean(),
});

function envelope(d) {
  return z.object({ success: z.literal(true), data: d });
}
export const regionResponseSchema = envelope(regionSchema);
export const regionListResponseSchema = envelope(z.array(regionSchema));
