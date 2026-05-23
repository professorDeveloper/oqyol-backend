import { z } from "zod";

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
});

export const walletResponseSchema = envelope(walletSchema);
