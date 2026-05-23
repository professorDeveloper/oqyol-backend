import { prisma } from "../../clients/prisma.js";

const include = {
  driver: { select: { id: true, firstName: true, lastName: true } },
};

export function create(data) {
  return prisma.offer.create({ data, include });
}

export function findById(id) {
  return prisma.offer.findUnique({ where: { id }, include });
}

export function findPendingByDriverAndOrder(driverId, orderId) {
  return prisma.offer.findFirst({
    where: { driverId, orderId, status: "PENDING" },
  });
}

export function listForOrder(orderId) {
  return prisma.offer.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    include,
  });
}

export function countDriverOffers({ driverId, status }) {
  return prisma.offer.count({
    where: { driverId, ...(status ? { status } : {}) },
  });
}

export function listDriverOffers({ driverId, status }, { skip, take }) {
  return prisma.offer.findMany({
    where: { driverId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: {
      order: { include: { route: { include: { fromRegion: true, toRegion: true } } } },
    },
  });
}

export function update(id, data) {
  return prisma.offer.update({ where: { id }, data, include });
}
