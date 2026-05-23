import { z } from "zod";

const plateNumber = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/\s+/gu, ""))
  .pipe(
    z
      .string()
      .regex(/^\d{2}[A-Z]\d{3}[A-Z]{2}$/u, "Plate must match Uzbekistan format, e.g. 01A123BC")
  )
  .describe("Uzbekistan vehicle plate, e.g. 01A123BC");

const brand = z.string().trim().min(1).max(40);
const model = z.string().trim().min(1).max(40);
const color = z.string().trim().min(1).max(30);

const currentYear = new Date().getFullYear();
const year = z.coerce
  .number()
  .int()
  .min(1990, "Year must be 1990 or later")
  .max(currentYear + 1, `Year must be ${currentYear + 1} or earlier`);

const seatCount = z.coerce.number().int().min(2).max(9);

export const createVehicleSchema = z.object({
  brand,
  model,
  color,
  plateNumber,
  year,
  seatCount,
});

export const updateVehicleSchema = z
  .object({
    brand: brand.optional(),
    model: model.optional(),
    color: color.optional(),
    plateNumber: plateNumber.optional(),
    year: year.optional(),
    seatCount: seatCount.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export const vehicleIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const vehicleSchema = z.object({
  id: z.string().uuid(),
  brand: z.string(),
  model: z.string(),
  color: z.string(),
  plateNumber: z.string(),
  year: z.number().int(),
  seatCount: z.number().int(),
  photoUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

function envelope(dataSchema) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export const vehicleResponseSchema = envelope(vehicleSchema);
export const vehicleNullableResponseSchema = envelope(vehicleSchema.nullable());
export const vehicleDeleteResponseSchema = envelope(z.object({ message: z.string() }));
