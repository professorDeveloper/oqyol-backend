import { prisma } from "../../clients/prisma.js";

export function listByRegion(regionId) {
  return prisma.district.findMany({
    where: { regionId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export function listAllActive() {
  return prisma.district.findMany({
    where: { isActive: true },
    orderBy: [{ regionId: "asc" }, { name: "asc" }],
    include: { region: { select: { id: true, name: true, code: true } } },
  });
}

export function findById(id) {
  return prisma.district.findUnique({
    where: { id },
    include: { region: { select: { id: true, name: true, code: true } } },
  });
}
