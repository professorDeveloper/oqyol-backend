import { prisma } from "../../clients/prisma.js";

const orderInclude = {
  route: {
    include: {
      fromRegion: { select: { id: true, name: true, lat: true, lng: true } },
      toRegion: { select: { id: true, name: true, lat: true, lng: true } },
    },
  },
  passenger: { select: { id: true, firstName: true, lastName: true, phone: true } },
  driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
  offers: { orderBy: { createdAt: "desc" } },
};

export function createOrder(data, tx = prisma) {
  return tx.order.create({ data, include: orderInclude });
}

export function findById(id, tx = prisma) {
  return tx.order.findUnique({ where: { id }, include: orderInclude });
}

export function updateOrder(id, data, tx = prisma) {
  return tx.order.update({ where: { id }, data, include: orderInclude });
}

export function logStatusChange({ orderId, status, changedBy, metadata = null }, tx = prisma) {
  return tx.orderStatusHistory.create({
    data: { orderId, status, changedBy, metadata },
  });
}

export function countPassengerOrders({ userId, status }) {
  return prisma.order.count({
    where: { passengerId: userId, ...(status ? { status } : {}) },
  });
}

export function listPassengerOrders({ userId, status }, { skip, take }) {
  return prisma.order.findMany({
    where: { passengerId: userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: orderInclude,
  });
}

export function countOpenOrders(filter) {
  return prisma.order.count({
    where: {
      status: "OPEN",
      expiresAt: { gt: new Date() },
      ...(filter.fromRegionId || filter.toRegionId
        ? {
            route: {
              ...(filter.fromRegionId ? { fromRegionId: filter.fromRegionId } : {}),
              ...(filter.toRegionId ? { toRegionId: filter.toRegionId } : {}),
            },
          }
        : {}),
    },
  });
}

export function listOpenOrders(filter, { skip, take }) {
  return prisma.order.findMany({
    where: {
      status: "OPEN",
      expiresAt: { gt: new Date() },
      ...(filter.fromRegionId || filter.toRegionId
        ? {
            route: {
              ...(filter.fromRegionId ? { fromRegionId: filter.fromRegionId } : {}),
              ...(filter.toRegionId ? { toRegionId: filter.toRegionId } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: orderInclude,
  });
}

export function createLocationProof(data, tx = prisma) {
  return tx.orderLocationProof.create({ data });
}
