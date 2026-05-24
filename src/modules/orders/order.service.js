import crypto from "node:crypto";
import { prisma } from "../../clients/prisma.js";
import * as repo from "./order.repository.js";
import * as walletService from "../wallet/wallet.service.js";
import { env } from "../../config/env.js";
import { paginate, buildPage } from "../../shared/pagination.js";
import { commissionAmount } from "../../shared/pricing.js";
import { haversineMeters } from "../../shared/geo.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.js";

function publicOrder(o, viewerRole = null) {
  return {
    id: o.id,
    status: o.status,
    rideType: o.rideType,
    seatsRequested: o.seatsRequested,
    passengerPrice: Number(o.passengerPrice),
    finalPrice: o.finalPrice ? Number(o.finalPrice) : null,
    pickup:
      o.pickupLat != null && o.pickupLng != null
        ? { lat: o.pickupLat, lng: o.pickupLng, address: o.pickupAddress ?? null }
        : null,
    dropoff:
      o.dropoffLat != null && o.dropoffLng != null
        ? { lat: o.dropoffLat, lng: o.dropoffLng, address: o.dropoffAddress ?? null }
        : null,
    route: o.route
      ? {
          id: o.route.id,
          distanceKm: o.route.distanceKm,
          estimatedDurationMin: o.route.estimatedDurationMin,
          basePrice: Number(o.route.basePrice),
          fromRegion: o.route.fromRegion,
          toRegion: o.route.toRegion,
        }
      : null,
    passenger: o.passenger
      ? {
          id: o.passenger.id,
          firstName: o.passenger.firstName,
          lastName: o.passenger.lastName,
          phone: viewerRole === "DRIVER" && o.status !== "OPEN" ? o.passenger.phone : null,
        }
      : null,
    driver: o.driver
      ? {
          id: o.driver.id,
          firstName: o.driver.firstName,
          lastName: o.driver.lastName,
          phone: o.driver.phone,
        }
      : null,
    otpCode: viewerRole === "USER" && ["ACCEPTED", "ARRIVED"].includes(o.status) ? o.otpCode : null,
    scheduledAt: o.scheduledAt?.toISOString() ?? null,
    acceptedAt: o.acceptedAt?.toISOString() ?? null,
    arrivedAt: o.arrivedAt?.toISOString() ?? null,
    foundAt: o.foundAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    cancellationReason: o.cancellationReason,
    expiresAt: o.expiresAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    offers: o.offers
      ? o.offers.map((of) => ({
          id: of.id,
          driverId: of.driverId,
          offeredPrice: Number(of.offeredPrice),
          status: of.status,
          message: of.message,
          expiresAt: of.expiresAt.toISOString(),
          createdAt: of.createdAt.toISOString(),
        }))
      : undefined,
  };
}

function generateOrderOtp() {
  return String(crypto.randomInt(1000, 10000));
}

// ─── Passenger ────────────────────────────────────────────────────────────

const PASSENGER_PRICE_MIN_MULTIPLIER = 0.3;
const PASSENGER_PRICE_MAX_MULTIPLIER = 5;

export async function createOrder(userId, body) {
  const route = await prisma.route.findUnique({ where: { id: body.routeId } });
  if (!route || !route.isActive) throw new BadRequestError("Route not available", "ROUTE_INVALID");

  const basePrice = Number(route.basePrice);
  const minPrice = basePrice * PASSENGER_PRICE_MIN_MULTIPLIER;
  const maxPrice = basePrice * PASSENGER_PRICE_MAX_MULTIPLIER;
  if (body.passengerPrice < minPrice || body.passengerPrice > maxPrice) {
    throw new BadRequestError(
      `Narx ${Math.round(minPrice)}–${Math.round(maxPrice)} so'm oralig'ida bo'lishi kerak (tavsiya: ${basePrice})`,
      "PRICE_OUT_OF_RANGE"
    );
  }

  const hasOpen = await prisma.order.findFirst({
    where: {
      passengerId: userId,
      status: { in: ["OPEN", "ACCEPTED", "ARRIVED"] },
    },
  });
  if (hasOpen) {
    throw new ConflictError("You already have an active order", "ACTIVE_ORDER_EXISTS");
  }

  const expiresAt = new Date(Date.now() + env.ORDER_TTL_MINUTES * 60_000);

  const order = await prisma.$transaction(async (tx) => {
    const created = await repo.createOrder(
      {
        passengerId: userId,
        routeId: route.id,
        rideType: body.rideType,
        seatsRequested: body.seatsRequested,
        passengerPrice: body.passengerPrice,
        pickupLat: body.pickupLat ?? null,
        pickupLng: body.pickupLng ?? null,
        pickupAddress: body.pickupAddress ?? null,
        dropoffLat: body.dropoffLat ?? null,
        dropoffLng: body.dropoffLng ?? null,
        dropoffAddress: body.dropoffAddress ?? null,
        scheduledAt: body.scheduledAt ?? null,
        expiresAt,
      },
      tx
    );
    await repo.logStatusChange({ orderId: created.id, status: "OPEN", changedBy: userId }, tx);
    return created;
  });

  return publicOrder(order, "USER");
}

export async function listMyOrders(userId, query) {
  const { skip, take } = paginate(query);
  const [items, total] = await Promise.all([
    repo.listPassengerOrders({ userId, status: query.status }, { skip, take }),
    repo.countPassengerOrders({ userId, status: query.status }),
  ]);
  return buildPage({
    items: items.map((o) => publicOrder(o, "USER")),
    total,
    page: query.page,
    limit: query.limit,
  });
}

async function loadOrderOrFail(orderId) {
  const order = await repo.findById(orderId);
  if (!order) throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
  return order;
}

export async function getOrder(orderId, user) {
  const order = await loadOrderOrFail(orderId);
  if (
    user.role !== "ADMIN" &&
    order.passengerId !== user.id &&
    order.driverId !== user.id
  ) {
    // Drivers may also read OPEN orders (discovery), even if not assigned
    if (!(user.role === "DRIVER" && order.status === "OPEN")) {
      throw new ForbiddenError("Not your order", "FORBIDDEN");
    }
  }
  return publicOrder(order, user.role);
}

export async function cancelOrder(orderId, user, reason) {
  const order = await loadOrderOrFail(orderId);
  const isPassenger = order.passengerId === user.id;
  const isDriver = order.driverId === user.id;
  if (!isPassenger && !isDriver && user.role !== "ADMIN") {
    throw new ForbiddenError("Not your order", "FORBIDDEN");
  }
  if (!["OPEN", "ACCEPTED", "ARRIVED"].includes(order.status)) {
    throw new BadRequestError("Order cannot be cancelled in this state", "INVALID_STATE");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await repo.updateOrder(
      order.id,
      {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: user.id,
        cancellationReason: reason,
      },
      tx
    );
    await repo.logStatusChange(
      { orderId: order.id, status: "CANCELLED", changedBy: user.id, metadata: { reason } },
      tx
    );
    if (["ACCEPTED", "ARRIVED"].includes(order.status) && order.driverId) {
      await walletService.releaseCommission(tx, { orderId: order.id });
    }
    return publicOrder(updated, user.role);
  });
}

// ─── Driver: discovery & lifecycle ─────────────────────────────────────────

export async function listOpenOrders(query) {
  const { skip, take } = paginate(query);
  const [items, total] = await Promise.all([
    repo.listOpenOrders(query, { skip, take }),
    repo.countOpenOrders(query),
  ]);
  return buildPage({
    items: items.map((o) => publicOrder(o, "DRIVER")),
    total,
    page: query.page,
    limit: query.limit,
  });
}

export async function driverArrive(orderId, driver, { lat, lng, accuracyMeters }) {
  const order = await loadOrderOrFail(orderId);
  if (order.driverId !== driver.id) throw new ForbiddenError("Not your order", "FORBIDDEN");
  if (order.status !== "ACCEPTED") {
    throw new BadRequestError("Order is not in ACCEPTED state", "INVALID_STATE");
  }

  // Yo'lovchi aniq pin tanlagan bo'lsa — o'sha nuqtaga yaqinligini tekshiramiz;
  // aks holda viloyat markazi (eski hulq, backward-compat).
  const pickupPoint =
    order.pickupLat != null && order.pickupLng != null
      ? { lat: order.pickupLat, lng: order.pickupLng }
      : { lat: order.route.fromRegion.lat, lng: order.route.fromRegion.lng };
  const distance = haversineMeters({ lat, lng }, pickupPoint);
  const isValid = distance <= env.ARRIVAL_RADIUS_METERS;

  return prisma.$transaction(async (tx) => {
    await repo.createLocationProof(
      {
        orderId: order.id,
        driverId: driver.id,
        lat,
        lng,
        accuracyMeters,
        distanceToPickupM: distance,
        isValid,
        checkedAt: new Date(),
      },
      tx
    );
    if (!isValid) {
      throw new BadRequestError(
        `Too far from pickup (${Math.round(distance)}m). Get within ${env.ARRIVAL_RADIUS_METERS}m.`,
        "TOO_FAR_FROM_PICKUP"
      );
    }
    const updated = await repo.updateOrder(
      order.id,
      { status: "ARRIVED", arrivedAt: new Date() },
      tx
    );
    await repo.logStatusChange(
      { orderId: order.id, status: "ARRIVED", changedBy: driver.id, metadata: { distance } },
      tx
    );
    return publicOrder(updated, "DRIVER");
  });
}

export async function driverFound(orderId, driver, { otpCode }) {
  const order = await loadOrderOrFail(orderId);
  if (order.driverId !== driver.id) throw new ForbiddenError("Not your order", "FORBIDDEN");
  if (order.status !== "ARRIVED") {
    throw new BadRequestError("Order is not in ARRIVED state", "INVALID_STATE");
  }
  if (order.otpCode !== otpCode) {
    throw new BadRequestError("Wrong passenger OTP", "WRONG_OTP");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await repo.updateOrder(
      order.id,
      { status: "FOUND", foundAt: new Date() },
      tx
    );
    await repo.logStatusChange(
      { orderId: order.id, status: "FOUND", changedBy: driver.id },
      tx
    );
    await walletService.captureCommission(tx, { orderId: order.id });
    return publicOrder(updated, "DRIVER");
  });
}

// ─── Offer flow (used by offers module) ────────────────────────────────────

export async function acceptOffer(passengerId, offerId) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { order: true },
  });
  if (!offer) throw new NotFoundError("Offer not found", "OFFER_NOT_FOUND");
  if (offer.order.passengerId !== passengerId) {
    throw new ForbiddenError("Not your order", "FORBIDDEN");
  }
  if (offer.order.status !== "OPEN") {
    throw new BadRequestError("Order is no longer open", "INVALID_STATE");
  }
  if (offer.status !== "PENDING") {
    throw new BadRequestError("Offer is no longer pending", "INVALID_STATE");
  }
  if (offer.expiresAt < new Date()) {
    throw new BadRequestError("Offer expired", "OFFER_EXPIRED");
  }

  return prisma.$transaction(async (tx) => {
    const commission = commissionAmount(Number(offer.offeredPrice));
    await walletService.holdCommission(tx, {
      userId: offer.driverId,
      orderId: offer.orderId,
      amount: commission,
    });

    await tx.offer.update({
      where: { id: offer.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
    await tx.offer.updateMany({
      where: { orderId: offer.orderId, id: { not: offer.id }, status: "PENDING" },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    const updated = await repo.updateOrder(
      offer.orderId,
      {
        status: "ACCEPTED",
        driverId: offer.driverId,
        finalPrice: offer.offeredPrice,
        acceptedAt: new Date(),
        otpCode: generateOrderOtp(),
      },
      tx
    );
    await repo.logStatusChange(
      {
        orderId: offer.orderId,
        status: "ACCEPTED",
        changedBy: passengerId,
        metadata: { offerId: offer.id, finalPrice: Number(offer.offeredPrice) },
      },
      tx
    );

    return publicOrder(updated, "USER");
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────

export async function adminForceCancel(orderId, adminId, reason) {
  const order = await loadOrderOrFail(orderId);
  if (["FOUND", "CANCELLED", "EXPIRED"].includes(order.status)) {
    throw new BadRequestError("Order already terminal", "INVALID_STATE");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await repo.updateOrder(
      order.id,
      {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: adminId,
        cancellationReason: `[admin] ${reason}`,
      },
      tx
    );
    await repo.logStatusChange(
      { orderId: order.id, status: "CANCELLED", changedBy: adminId, metadata: { admin: true, reason } },
      tx
    );
    if (["ACCEPTED", "ARRIVED"].includes(order.status) && order.driverId) {
      await walletService.releaseCommission(tx, { orderId: order.id });
    }
    return publicOrder(updated, "ADMIN");
  });
}

export { publicOrder };
