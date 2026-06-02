import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

export const transactionsQuerySchema = paginationQuerySchema;

export const adjustSchema = z.object({
  amount: z.coerce.number().refine((v) => v !== 0, "amount cannot be zero"),
  description: z.string().trim().min(1).max(200),
});

export const userIdParamSchema = z.object({ id: z.string().uuid() });

function envelope(d) {
  return z.object({ success: z.literal(true), data: d });
}

const walletSchema = z.object({
  balance: z.number(),
  heldAmount: z.number(),
});

export const walletResponseSchema = envelope(walletSchema);
