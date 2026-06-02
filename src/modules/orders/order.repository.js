import { prisma } from "../../clients/prisma.js";

const orderInclude = {
  route: {
    include: {
      fromRegion: { select: { id: true, name: true, lat: true, lng: true } },
      toRegion: { select: { id: true, name: true, lat: true, lng: true } },
    },
  },
  // Route'siz orderlar uchun to'g'ridan-to'g'ri Region linklari.
  fromRegion: { select: { id: true, name: true, lat: true, lng: true } },
  toRegion: { select: { id: true, name: true, lat: true, lng: true } },
  passenger: { select: { id: true, firstName: true, lastName: true, phone: true } },
  driver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
      driverProfile: {
        select: {
          avgRating: true,
          totalRatings: true,
          vehicle: {
            select: { brand: true, model: true, color: true, plateNumber: true, year: true },
          },
        },
      },
    },
  },
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

function statusWhere(status) {
  if (!status) return {};
  const arr = Array.isArray(status) ? status : [status];
  return arr.length === 1 ? { status: arr[0] } : { status: { in: arr } };
}

export function countPassengerOrders({ userId, status }) {
  return prisma.order.count({
    where: { passengerId: userId, ...statusWhere(status) },
  });
}

export function listPassengerOrders({ userId, status }, { skip, take }) {
  return prisma.order.findMany({
    where: { passengerId: userId, ...statusWhere(status) },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: orderInclude,
  });
}

// Order viloyat bo'yicha qidirilganda — route bog'langan bo'lsa route'dagi
// regions'ga, route'siz bo'lsa orderdagi to'g'ridan-to'g'ri fromRegionId/toRegionId'ga moslanadi.
function regionFilterWhere(filter) {
  if (!filter.fromRegionId && !filter.toRegionId) return {};
  const routeSide = {
    ...(filter.fromRegionId ? { fromRegionId: filter.fromRegionId } : {}),
    ...(filter.toRegionId ? { toRegionId: filter.toRegionId } : {}),
  };
  const directSide = {
    ...(filter.fromRegionId ? { fromRegionId: filter.fromRegionId } : {}),
    ...(filter.toRegionId ? { toRegionId: filter.toRegionId } : {}),
  };
  return { OR: [{ route: routeSide }, directSide] };
}

export function countOpenOrders(filter) {
  return prisma.order.count({
    where: {
      status: "OPEN",
      expiresAt: { gt: new Date() },
      ...regionFilterWhere(filter),
    },
  });
}

export function listOpenOrders(filter, { skip, take }) {
  return prisma.order.findMany({
    where: {
      status: "OPEN",
      expiresAt: { gt: new Date() },
      ...regionFilterWhere(filter),
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
