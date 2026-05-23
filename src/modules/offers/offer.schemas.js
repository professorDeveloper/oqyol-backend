import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

const uuid = z.string().uuid();

export const createOfferSchema = z.object({
  orderId: uuid,
  offeredPrice: z.coerce.number().positive().max(100_000_000),
  message: z.string().trim().max(200).optional(),
});

export const offerIdParamSchema = z.object({ id: uuid });

export const orderIdParamSchema = z.object({ orderId: uuid });

export const driverOffersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
});
