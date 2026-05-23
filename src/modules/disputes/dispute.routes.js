import { Router } from "express";
import * as service from "./dispute.service.js";
import {
  createDisputeSchema,
  listQuerySchema,
  disputeIdParamSchema,
} from "./dispute.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

const router = Router();
router.use(requireAuth);

router.post(
  "/",
  validate(createDisputeSchema),
  asyncHandler(async (req, res) => ok(res, await service.open(req.user.id, req.body), 201))
);

router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listMy(req.user.id, req.query)))
);

router.get(
  "/:id",
  validate(disputeIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id, req.user.id)))
);

export default router;
