import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

export const createDisputeSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
});

export const listQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "REJECTED"]).optional(),
});

export const disputeIdParamSchema = z.object({ id: z.string().uuid() });
