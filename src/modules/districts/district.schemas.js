import { z } from "zod";

export const districtIdParamSchema = z.object({ id: z.string().uuid() });
export const regionIdParamSchema = z.object({ regionId: z.string().uuid() });

const districtSchema = z.object({
  id: z.string().uuid(),
  regionId: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
});

const districtWithRegionSchema = districtSchema.extend({
  region: z
    .object({ id: z.string().uuid(), name: z.string(), code: z.string().nullable() })
    .nullable(),
});

function envelope(d) {
  return z.object({ success: z.literal(true), data: d });
}

export const districtListResponseSchema = envelope(z.array(districtSchema));
export const districtListWithRegionResponseSchema = envelope(z.array(districtWithRegionSchema));
export const districtResponseSchema = envelope(districtWithRegionSchema);
