import { prisma } from "../../clients/prisma.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.js";

export async function getUserRating(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found", "USER_NOT_FOUND");
  const agg = await prisma.rating.aggregate({
    where: { ratedId: userId },
    _avg: { score: true },
    _count: { _all: true },
  });
  return {
    userId,
    avgRating: agg._avg.score ? Number(agg._avg.score.toFixed(1)) : null,
    totalRatings: agg._count._all,
  };
}

export async function rateOrder(orderId, rater, { score }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Order not found", "ORDER_NOT_FOUND");
  if (order.status !== "FOUND") {
    throw new BadRequestError("Order is not completed", "ORDER_NOT_COMPLETED");
  }
  const isPassenger = order.passengerId === rater.id;
  const isDriver = order.driverId === rater.id;
  if (!isPassenger && !isDriver) {
    throw new ForbiddenError("Not your order", "FORBIDDEN");
  }
  const ratedId = isPassenger ? order.driverId : order.passengerId;
  if (!ratedId) throw new BadRequestError("No counterparty to rate", "INVALID_STATE");

  const existing = await prisma.rating.findFirst({
    where: { orderId, raterId: rater.id },
  });
  if (existing) throw new ConflictError("You already rated this order", "ALREADY_RATED");

  return prisma.$transaction(async (tx) => {
    const rating = await tx.rating.create({
      data: { orderId, raterId: rater.id, ratedId, score },
    });

    // If rater is passenger, recompute driver's avg rating
    if (isPassenger) {
      const driverProfile = await tx.driverProfile.findUnique({
        where: { userId: ratedId },
      });
      if (driverProfile) {
        const agg = await tx.rating.aggregate({
          where: { ratedId },
          _avg: { score: true },
          _count: { _all: true },
        });
        const avg = agg._avg.score ?? 0;
        await tx.driverProfile.update({
          where: { id: driverProfile.id },
          data: {
            avgRating: Number(avg.toFixed(1)),
            totalRatings: agg._count._all,
          },
        });
      }
    }

    return {
      id: rating.id,
      orderId: rating.orderId,
      ratedId: rating.ratedId,
      score: rating.score,
      createdAt: rating.createdAt.toISOString(),
    };
  });
}
