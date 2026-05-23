import { Router } from "express";
import * as service from "./offer.service.js";
import {
  createOfferSchema,
  offerIdParamSchema,
  orderIdParamSchema,
  driverOffersQuerySchema,
} from "./offer.schemas.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";

// Driver: /api/driver/offers
const driverRouter = Router();
driverRouter.use(requireAuth, requireRole("DRIVER"));

driverRouter.post(
  "/",
  validate(createOfferSchema),
  asyncHandler(async (req, res) => ok(res, await service.createOffer(req.user.id, req.body), 201))
);

driverRouter.get(
  "/mine",
  validate(driverOffersQuerySchema, "query"),
  asyncHandler(async (req, res) => ok(res, await service.listMyOffers(req.user.id, req.query)))
);

driverRouter.post(
  "/:id/cancel",
  validate(offerIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.cancelMyOffer(req.user.id, req.params.id)))
);

// Passenger: /api/orders/:orderId/offers + /api/offers/:id/accept|reject
const passengerOrderOffersRouter = Router({ mergeParams: true });
passengerOrderOffersRouter.use(requireAuth);
passengerOrderOffersRouter.get(
  "/",
  validate(orderIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.listOrderOffers(req.user.id, req.params.orderId)))
);

const passengerOfferActionRouter = Router();
passengerOfferActionRouter.use(requireAuth);

passengerOfferActionRouter.post(
  "/:id/accept",
  validate(offerIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.acceptOffer(req.user.id, req.params.id)))
);

passengerOfferActionRouter.post(
  "/:id/reject",
  validate(offerIdParamSchema, "params"),
  asyncHandler(async (req, res) => ok(res, await service.rejectOffer(req.user.id, req.params.id)))
);

export {
  driverRouter as offersDriverRouter,
  passengerOrderOffersRouter as offersOnOrderRouter,
  passengerOfferActionRouter as offersActionRouter,
};
