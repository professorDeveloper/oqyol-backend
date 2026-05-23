import { prisma } from "../../clients/prisma.js";
import * as repo from "./dispute.repository.js";
import { paginate, buildPage } from "../../shared/pagination.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.js";

function publicDispute(d) {
  return {
    id: d.id,
    orderId: d.orderId,
    reason: d.reason,
    description: d.description,
    status: d.status,
    resolution: d.resolution ?? null,
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    order: d.order ? { id: d.order.id, status: d.order.status } : null,
  };
}

export async function open(userId, { orderId, reason, description }) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Buyurtma topilmadi", "ORDER_NOT_FOUND");
  if (order.passengerId !== userId && order.driverId !== userId) {
    throw new ForbiddenError("Bu buyurtma sizniki emas", "FORBIDDEN");
  }
  if (!["ACCEPTED", "ARRIVED", "FOUND", "CANCELLED"].includes(order.status)) {
    throw new BadRequestError("Bu holatda dispute ochib bo'lmaydi", "INVALID_STATE");
  }

  const existing = await repo.findOpenForOrderByUser(orderId, userId);
  if (existing) {
    throw new ConflictError(
      "Bu buyurtma uchun ochiq dispute mavjud",
      "DISPUTE_ALREADY_OPEN"
    );
  }

  const created = await repo.create({
    orderId,
    openedBy: userId,
    reason,
    description,
  });
  return publicDispute(created);
}

export async function listMy(userId, query) {
  const { skip, take } = paginate(query);
  const [items, total] = await Promise.all([
    repo.listByUser({ userId, status: query.status }, { skip, take }),
    repo.countByUser({ userId, status: query.status }),
  ]);
  return buildPage({
    items: items.map(publicDispute),
    total,
    page: query.page,
    limit: query.limit,
  });
}

export async function getById(id, userId) {
  const d = await repo.findById(id);
  if (!d || d.openedBy !== userId) {
    throw new NotFoundError("Dispute topilmadi", "DISPUTE_NOT_FOUND");
  }
  return publicDispute(d);
}
