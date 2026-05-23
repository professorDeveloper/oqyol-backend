import { prisma } from "../../clients/prisma.js";

function buildWhere({ search, role, registeredApp, isActive }) {
  return {
    ...(role ? { role } : {}),
    ...(registeredApp ? { registeredApp } : {}),
    ...(typeof isActive === "boolean" ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { phone: { contains: search } },
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { referralCode: { contains: search.toUpperCase() } },
          ],
        }
      : {}),
  };
}

export function countUsers(filter) {
  return prisma.user.count({ where: buildWhere(filter) });
}

export function findUsers(filter, { skip, take }) {
  return prisma.user.findMany({
    where: buildWhere(filter),
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export function findUserDetail(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      driverProfile: { include: { vehicle: true } },
      wallet: true,
    },
  });
}

export function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

export function updateUser(id, data) {
  return prisma.user.update({ where: { id }, data });
}

export function updateDriverProfile(userId, data) {
  return prisma.driverProfile.update({ where: { userId }, data });
}
