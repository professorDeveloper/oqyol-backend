import { Router } from "express";
import * as service from "./wallet.service.js";
import { adjustSchema, userIdParamSchema } from "./wallet.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.post(
  "/:id/adjust",
  validate(userIdParamSchema, "params"),
  validate(adjustSchema),
  asyncHandler(async (req, res) => ok(res, await service.adminAdjust(req.params.id, req.body)))
);

export { adminRouter as walletAdminRouter };
