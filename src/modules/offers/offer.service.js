import { prisma } from "../../clients/prisma.js";
import * as repo from "./offer.repository.js";
import * as orderService from "../orders/order.service.js";
import { env } from "../../config/env.js";
import { paginate, buildPage } from "../../shared/pagination.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.js";

function publicOffer(o) {
  return {
    id: o.id,
    orderId: o.orderId,
    driverId: o.driverId,
    offeredPrice: Number(o.offeredPrice),
    status: o.status,
    message: o.message,
    expiresAt: o.expiresAt.toISOString(),
    respondedAt: o.respondedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    // `price` alias so passenger app (which reads `price`) shows the amount.
    price: Number(o.offeredPrice),
    driver: o.driver
      ? {
          id: o.driver.id,
          firstName: o.driver.firstName,
          lastName: o.driver.lastName,
          avatarUrl: o.driver.avatarUrl ?? null,
          rating: o.driver.driverProfile?.avgRating != null
            ? Number(o.driver.driverProfile.avgRating)
            : null,
          totalRatings: o.driver.driverProfile?.totalRatings ?? 0,
        }
      : undefined,
    vehicle: o.driver?.driverProfile?.vehicle
      ? {
          brand: o.driver.driverProfile.vehicle.brand,
          model: `${o.driver.driverProfile.vehicle.brand} ${o.driver.driverProfile.vehicle.model}`.trim(),
          color: o.driver.driverProfile.vehicle.color,
          plateNumber: o.driver.driverProfile.vehicle.plateNumber,
          year: o.driver.driverProfile.vehicle.year,
        }
      : undefined,
  };
}

export async function createOffer(driverId, { orderId, offeredPrice, message }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
  if (order.status !== "OPEN") {
    throw new BadRequestError("Order is not open", "ORDER_NOT_OPEN");
  }
  if (order.expiresAt < new Date()) {
    throw new BadRequestError("Order expired", "ORDER_EXPIRED");
  }
  if (order.passengerId === driverId) {
    throw new BadRequestError("Cannot offer on your own order", "SELF_OFFER");
  }
  const existing = await repo.findPendingByDriverAndOrder(driverId, orderId);
  if (existing) {
    throw new ConflictError("You already have a pending offer on this order", "OFFER_EXISTS");
  }

  const expiresAt = new Date(Date.now() + env.OFFER_TTL_MINUTES * 60_000);
  const created = await repo.create({
    orderId,
    driverId,
    offeredPrice,
    message: message ?? null,
    expiresAt,
  });
  return publicOffer(created);
}

export async function listOrderOffers(passengerId, orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
  if (order.passengerId !== passengerId) {
    throw new ForbiddenError("Not your order", "FORBIDDEN");
  }
  const offers = await repo.listForOrder(orderId);
  return offers.map(publicOffer);
}

export async function listMyOffers(driverId, query) {
  const { skip, take } = paginate(query);
  const [items, total] = await Promise.all([
    repo.listDriverOffers({ driverId, status: query.status }, { skip, take }),
    repo.countDriverOffers({ driverId, status: query.status }),
  ]);
  return buildPage({
    items: items.map((o) => ({
      ...publicOffer(o),
      order: o.order
        ? {
            id: o.order.id,
            status: o.order.status,
            route: o.order.route
              ? {
                  id: o.order.route.id,
                  basePrice: Number(o.order.route.basePrice),
                  fromRegion: { id: o.order.route.fromRegion.id, name: o.order.route.fromRegion.name },
                  toRegion: { id: o.order.route.toRegion.id, name: o.order.route.toRegion.name },
                }
              : null,
          }
        : null,
    })),
    total,
    page: query.page,
    limit: query.limit,
  });
}

export async function cancelMyOffer(driverId, offerId) {
  const offer = await repo.findById(offerId);
  if (!offer) throw new NotFoundError("Offer not found", "OFFER_NOT_FOUND");
  if (offer.driverId !== driverId) throw new ForbiddenError("Not your offer", "FORBIDDEN");
  if (offer.status !== "PENDING") {
    throw new BadRequestError("Offer is not pending", "INVALID_STATE");
  }
  const updated = await repo.update(offer.id, {
    status: "REJECTED",
    respondedAt: new Date(),
  });
  return publicOffer(updated);
}

export async function acceptOffer(passengerId, offerId) {
  return orderService.acceptOffer(passengerId, offerId);
}

export async function rejectOffer(passengerId, offerId) {
  const offer = await repo.findById(offerId);
  if (!offer) throw new NotFoundError("Offer not found", "OFFER_NOT_FOUND");
  const order = await prisma.order.findUnique({ where: { id: offer.orderId } });
  if (!order || order.passengerId !== passengerId) {
    throw new ForbiddenError("Not your order", "FORBIDDEN");
  }
  if (offer.status !== "PENDING") {
    throw new BadRequestError("Offer is not pending", "INVALID_STATE");
  }
  const updated = await repo.update(offer.id, {
    status: "REJECTED",
    respondedAt: new Date(),
  });
  return publicOffer(updated);
}
