import * as vehicleRepo from "./vehicle.repository.js";
import * as r2 from "../../clients/r2.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors.js";

function publicVehicle(v) {
  return {
    id: v.id,
    brand: v.brand,
    model: v.model,
    color: v.color,
    plateNumber: v.plateNumber,
    year: v.year,
    seatCount: v.seatCount,
    photoUrl: v.photoUrl,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

async function getDriverProfileOrThrow(userId) {
  const profile = await vehicleRepo.findDriverProfileByUserId(userId);
  if (!profile) {
    throw new ForbiddenError(
      "Driver profile not found. Wait for admin approval.",
      "DRIVER_PROFILE_MISSING"
    );
  }
  return profile;
}

export async function getMyVehicle(userId) {
  const profile = await getDriverProfileOrThrow(userId);
  const vehicle = await vehicleRepo.findVehicleByDriver(profile.id);
  return vehicle ? publicVehicle(vehicle) : null;
}

export async function createVehicle({ userId, data, photoFile }) {
  const profile = await getDriverProfileOrThrow(userId);

  const existing = await vehicleRepo.findVehicleByDriver(profile.id);
  if (existing) {
    throw new ConflictError(
      "You already have a vehicle. Update or delete it first.",
      "VEHICLE_ALREADY_EXISTS"
    );
  }

  const plateOwner = await vehicleRepo.findVehicleByPlate(data.plateNumber);
  if (plateOwner) {
    throw new ConflictError("This plate number is already registered", "PLATE_TAKEN");
  }

  let photoUrl = null;
  if (photoFile) {
    const uploaded = await r2.uploadBuffer({
      buffer: photoFile.buffer,
      contentType: photoFile.mimetype,
      prefix: "vehicles",
      originalName: photoFile.originalname,
    });
    photoUrl = uploaded.url;
  }

  const created = await vehicleRepo.createVehicle({
    driverId: profile.id,
    ...data,
    photoUrl,
  });

  return publicVehicle(created);
}

export async function updateVehicle({ userId, vehicleId, data, photoFile }) {
  const profile = await getDriverProfileOrThrow(userId);
  const vehicle = await vehicleRepo.findVehicleById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found", "VEHICLE_NOT_FOUND");
  if (vehicle.driverId !== profile.id) {
    throw new ForbiddenError("Not your vehicle", "FORBIDDEN");
  }

  if (data.plateNumber && data.plateNumber !== vehicle.plateNumber) {
    const owner = await vehicleRepo.findVehicleByPlate(data.plateNumber);
    if (owner && owner.id !== vehicle.id) {
      throw new ConflictError("This plate number is already registered", "PLATE_TAKEN");
    }
  }

  let nextPhotoUrl = vehicle.photoUrl;
  let oldPhotoToDelete = null;
  if (photoFile) {
    const uploaded = await r2.uploadBuffer({
      buffer: photoFile.buffer,
      contentType: photoFile.mimetype,
      prefix: "vehicles",
      originalName: photoFile.originalname,
    });
    nextPhotoUrl = uploaded.url;
    oldPhotoToDelete = vehicle.photoUrl;
  }

  const updated = await vehicleRepo.updateVehicle(vehicle.id, {
    ...data,
    photoUrl: nextPhotoUrl,
  });

  if (oldPhotoToDelete) {
    await r2.deleteByUrl(oldPhotoToDelete);
  }

  return publicVehicle(updated);
}

export async function deleteVehicle({ userId, vehicleId }) {
  const profile = await getDriverProfileOrThrow(userId);
  const vehicle = await vehicleRepo.findVehicleById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehicle not found", "VEHICLE_NOT_FOUND");
  if (vehicle.driverId !== profile.id) {
    throw new ForbiddenError("Not your vehicle", "FORBIDDEN");
  }

  await vehicleRepo.deleteVehicle(vehicle.id);
  if (vehicle.photoUrl) {
    await r2.deleteByUrl(vehicle.photoUrl);
  }

  return { message: "Vehicle deleted" };
}
