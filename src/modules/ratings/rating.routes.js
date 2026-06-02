import { Router } from "express";
import * as service from "./rating.service.js";
import { orderIdParamSchema, userIdParamSchema, rateSchema } from "./rating.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

// Mounted at /api/orders/:id/ratings — submit a rating for a completed order
const router = Router({ mergeParams: true });
router.use(requireAuth);

router.post(
  "/",
  validate(orderIdParamSchema, "params"),
  validate(rateSchema),
  asyncHandler(async (req, res) => ok(res, await service.rateOrder(req.params.id, req.user, req.body), 201))
);

// Mounted at /api/ratings — read a user's aggregate rating (driver/passenger)
const publicRouter = Router();
publicRouter.use(requireAuth);

publicRouter.get(
  "/user/:id",
  validate(userIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.getUserRating(req.params.id)))
);

export default router;
export { publicRouter as ratingsPublicRouter };
