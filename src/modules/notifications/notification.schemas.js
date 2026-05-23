import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

export const listQuerySchema = paginationQuerySchema.extend({
  isRead: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const notificationIdParamSchema = z.object({ id: z.string().uuid() });
