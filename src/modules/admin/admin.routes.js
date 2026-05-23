import { Router } from "express";
import * as service from "./admin.service.js";
import {
  userListQuerySchema,
  userIdParamSchema,
  adminUpdateUserSchema,
  adminUpdateDriverSchema,
} from "./admin.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

router.get(
  "/users",
  validate(userListQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listUsers(req.query)))
);

router.get(
  "/users/:id",
  validate(userIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.getUserDetail(req.params.id)))
);

router.patch(
  "/users/:id",
  validate(userIdParamSchema, "params"),
  validate(adminUpdateUserSchema),
  asyncHandler(async (req, res) => ok(res, await service.updateUser(req.params.id, req.body)))
);

router.patch(
  "/drivers/:id",
  validate(userIdParamSchema, "params"),
  validate(adminUpdateDriverSchema),
  asyncHandler(async (req, res) => ok(res, await service.updateDriverProfile(req.params.id, req.body)))
);

export default router;
