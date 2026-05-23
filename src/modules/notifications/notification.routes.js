import { Router } from "express";
import * as service from "./notification.service.js";
import { listQuerySchema, notificationIdParamSchema } from "./notification.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listMy(req.user.id, req.query)))
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => ok(res, await service.markAllRead(req.user.id)))
);

router.patch(
  "/:id/read",
  validate(notificationIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.markRead(req.params.id, req.user.id)))
);

export default router;
