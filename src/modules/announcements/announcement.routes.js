import { Router } from "express";
import * as service from "./announcement.service.js";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  announcementIdParamSchema,
  feedQuerySchema,
  myQuerySchema,
} from "./announcement.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

// Driver: /api/driver/announcements
const driverRouter = Router();
driverRouter.use(requireAuth, requireRole("DRIVER"));

driverRouter.post(
  "/",
  validate(createAnnouncementSchema),
  asyncHandler(async (req, res) => ok(res, await service.create(req.user.id, req.body), 201))
);

driverRouter.get(
  "/mine",
  validate(myQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listMine(req.user.id, req.query)))
);

driverRouter.patch(
  "/:id",
  validate(announcementIdParamSchema, "params"),
  validate(updateAnnouncementSchema),
  asyncHandler(async (req, res) => ok(res, await service.update(req.user.id, req.params.id, req.body)))
);

driverRouter.delete(
  "/:id",
  validate(announcementIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.cancel(req.user.id, req.params.id)))
);

// Passenger feed: /api/announcements (any authenticated user)
const publicRouter = Router();
publicRouter.use(requireAuth);

publicRouter.get(
  "/",
  validate(feedQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listFeed(req.query)))
);

publicRouter.get(
  "/:id",
  validate(announcementIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.getById(req.params.id)))
);

export { driverRouter as announcementsDriverRouter, publicRouter as announcementsPublicRouter };
