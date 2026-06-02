import { z } from "zod";

export const orderIdParamSchema = z.object({ id: z.string().uuid() });

export const userIdParamSchema = z.object({ id: z.string().uuid() });

export const rateSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
});
