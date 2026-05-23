import { prisma } from "../../clients/prisma.js";

export function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

export function updateUser(id, data) {
  return prisma.user.update({ where: { id }, data });
}

export function findDriverProfileByUserId(userId) {
  return prisma.driverProfile.findUnique({ where: { userId } });
}

export function updateDriverProfile(userId, data) {
  return prisma.driverProfile.update({ where: { userId }, data });
}

export function deleteAllUserSessions(userId, tx = prisma) {
  return tx.userSession.deleteMany({ where: { userId } });
}

export function cancelUserActiveOrders(userId, reason, tx = prisma) {
  return tx.order.updateMany({
    where: {
      passengerId: userId,
      status: { in: ["OPEN", "ACCEPTED", "ARRIVED"] },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: userId,
      cancellationReason: reason,
    },
  });
}
