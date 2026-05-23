import { prisma } from "../../clients/prisma.js";

export function listByUser({ userId, isRead }, { skip, take }) {
  return prisma.notification.findMany({
    where: { userId, ...(typeof isRead === "boolean" ? { isRead } : {}) },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
}

export function countByUser({ userId, isRead }) {
  return prisma.notification.count({
    where: { userId, ...(typeof isRead === "boolean" ? { isRead } : {}) },
  });
}

export function countUnreadByUser(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export function findById(id) {
  return prisma.notification.findUnique({ where: { id } });
}

export function markRead(id, userId) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
}

export function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export function create({ userId, title, body, type, data = null }) {
  return prisma.notification.create({
    data: { userId, title, body, type, data },
  });
}
