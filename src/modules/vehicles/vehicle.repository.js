import { prisma } from "../../clients/prisma.js";

export function findDriverProfileByUserId(userId) {
  return prisma.driverProfile.findUnique({ where: { userId } });
}

export function findVehicleByDriver(driverId) {
  return prisma.vehicle.findUnique({ where: { driverId } });
}

export function findVehicleById(id) {
  return prisma.vehicle.findUnique({ where: { id } });
}

export function findVehicleByPlate(plateNumber) {
  return prisma.vehicle.findUnique({ where: { plateNumber } });
}

export function createVehicle(data) {
  return prisma.vehicle.create({ data });
}

export function updateVehicle(id, data) {
  return prisma.vehicle.update({ where: { id }, data });
}

export function deleteVehicle(id) {
  return prisma.vehicle.delete({ where: { id } });
}
