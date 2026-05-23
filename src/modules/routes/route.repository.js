import { prisma } from "../../clients/prisma.js";

const include = {
  fromRegion: { select: { id: true, name: true } },
  toRegion: { select: { id: true, name: true } },
};

export function listActive({ fromRegionId, toRegionId }) {
  return prisma.route.findMany({
    where: {
      isActive: true,
      ...(fromRegionId ? { fromRegionId } : {}),
      ...(toRegionId ? { toRegionId } : {}),
    },
    orderBy: { basePrice: "asc" },
    include,
  });
}

export function listAll({ fromRegionId, toRegionId }) {
  return prisma.route.findMany({
    where: {
      ...(fromRegionId ? { fromRegionId } : {}),
      ...(toRegionId ? { toRegionId } : {}),
    },
    orderBy: { basePrice: "asc" },
    include,
  });
}

export function findById(id) {
  return prisma.route.findUnique({ where: { id }, include });
}

export function create(data) {
  return prisma.route.create({ data, include });
}

export function update(id, data) {
  return prisma.route.update({ where: { id }, data, include });
}

export function remove(id) {
  return prisma.route.delete({ where: { id } });
}
