import { Router } from "express";
import * as service from "./rating.service.js";
import { orderIdParamSchema, rateSchema } from "./rating.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.post(
  "/",
  validate(orderIdParamSchema, "params"),
  validate(rateSchema),
  asyncHandler(async (req, res) => ok(res, await service.rateOrder(req.params.id, req.user, req.body), 201))
);

export default router;
