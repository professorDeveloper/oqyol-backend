import { prisma } from "../../clients/prisma.js";

export function listActive() {
  return prisma.region.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export function listAll() {
  return prisma.region.findMany({ orderBy: { name: "asc" } });
}

export function findById(id) {
  return prisma.region.findUnique({ where: { id } });
}

export function create(data) {
  return prisma.region.create({ data });
}

export function update(id, data) {
  return prisma.region.update({ where: { id }, data });
}

export function remove(id) {
  return prisma.region.delete({ where: { id } });
}
