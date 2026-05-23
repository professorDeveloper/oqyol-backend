import { prisma } from "../../clients/prisma.js";

export function create({ orderId, openedBy, reason, description }) {
  return prisma.dispute.create({
    data: { orderId, openedBy, reason, description, status: "OPEN" },
  });
}

export function listByUser({ userId, status }, { skip, take }) {
  return prisma.dispute.findMany({
    where: { openedBy: userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: { order: { select: { id: true, status: true } } },
  });
}

export function countByUser({ userId, status }) {
  return prisma.dispute.count({
    where: { openedBy: userId, ...(status ? { status } : {}) },
  });
}

export function findById(id) {
  return prisma.dispute.findUnique({
    where: { id },
    include: { order: { select: { id: true, status: true } } },
  });
}

export function findOpenForOrderByUser(orderId, userId) {
  return prisma.dispute.findFirst({
    where: { orderId, openedBy: userId, status: { in: ["OPEN", "REVIEWING"] } },
  });
}
