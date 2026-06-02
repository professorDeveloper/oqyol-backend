import { prisma } from "../../clients/prisma.js";

const include = {
  route: { include: { fromRegion: true, toRegion: true } },
  driver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      driverProfile: { select: { avgRating: true, totalRatings: true } },
    },
  },
};

export function create(data) {
  return prisma.driverAnnouncement.create({ data, include });
}

export function findById(id) {
  return prisma.driverAnnouncement.findUnique({ where: { id }, include });
}

export function update(id, data) {
  return prisma.driverAnnouncement.update({ where: { id }, data, include });
}

function feedWhere({ routeId, fromRegionId, toRegionId }) {
  return {
    status: "ACTIVE",
    expiresAt: { gt: new Date() },
    ...(routeId ? { routeId } : {}),
    ...(fromRegionId || toRegionId
      ? {
          route: {
            ...(fromRegionId ? { fromRegionId } : {}),
            ...(toRegionId ? { toRegionId } : {}),
          },
        }
      : {}),
  };
}

export function listFeed(filter, { skip, take }) {
  return prisma.driverAnnouncement.findMany({
    where: feedWhere(filter),
    orderBy: { departureTime: "asc" },
    skip,
    take,
    include,
  });
}

export function countFeed(filter) {
  return prisma.driverAnnouncement.count({ where: feedWhere(filter) });
}

export function listMine({ driverId, status }, { skip, take }) {
  return prisma.driverAnnouncement.findMany({
    where: { driverId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include,
  });
}

export function countMine({ driverId, status }) {
  return prisma.driverAnnouncement.count({
    where: { driverId, ...(status ? { status } : {}) },
  });
}
