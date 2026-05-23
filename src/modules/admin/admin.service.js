import * as repo from "./admin.repository.js";
import { paginate, buildPage } from "../../shared/pagination.js";
import { NotFoundError } from "../../shared/errors.js";

function userListItem(u) {
  return {
    id: u.id,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    registeredApp: u.registeredApp,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listUsers(filter) {
  const { skip, take } = paginate(filter);
  const [items, total] = await Promise.all([
    repo.findUsers(filter, { skip, take }),
    repo.countUsers(filter),
  ]);
  return buildPage({
    items: items.map(userListItem),
    total,
    page: filter.page,
    limit: filter.limit,
  });
}

export async function getUserDetail(id) {
  const u = await repo.findUserDetail(id);
  if (!u) throw new NotFoundError("User not found", "USER_NOT_FOUND");
  return {
    ...userListItem(u),
    avatarUrl: u.avatarUrl,
    referralCode: u.referralCode,
    referredBy: u.referredBy,
    wallet: u.wallet
      ? { balance: Number(u.wallet.balance), heldAmount: Number(u.wallet.heldAmount) }
      : null,
    driverProfile: u.driverProfile
      ? {
          id: u.driverProfile.id,
          status: u.driverProfile.status,
          smokingAllowed: u.driverProfile.smokingAllowed,
          acAvailable: u.driverProfile.acAvailable,
          musicAllowed: u.driverProfile.musicAllowed,
          petsAllowed: u.driverProfile.petsAllowed,
          bio: u.driverProfile.bio,
          avgRating: u.driverProfile.avgRating ? Number(u.driverProfile.avgRating) : null,
          totalRatings: u.driverProfile.totalRatings,
          vehicle: u.driverProfile.vehicle
            ? {
                id: u.driverProfile.vehicle.id,
                brand: u.driverProfile.vehicle.brand,
                model: u.driverProfile.vehicle.model,
                plateNumber: u.driverProfile.vehicle.plateNumber,
                color: u.driverProfile.vehicle.color,
                year: u.driverProfile.vehicle.year,
                seatCount: u.driverProfile.vehicle.seatCount,
                photoUrl: u.driverProfile.vehicle.photoUrl,
              }
            : null,
        }
      : null,
  };
}

export async function updateUser(id, data) {
  const existing = await repo.findUserById(id);
  if (!existing) throw new NotFoundError("User not found", "USER_NOT_FOUND");
  const updated = await repo.updateUser(id, data);
  return userListItem(updated);
}

export async function updateDriverProfile(userId, data) {
  const existing = await repo.findUserDetail(userId);
  if (!existing || !existing.driverProfile) {
    throw new NotFoundError("Driver profile not found", "DRIVER_PROFILE_MISSING");
  }
  const updated = await repo.updateDriverProfile(userId, data);
  return {
    id: updated.id,
    status: updated.status,
    suspendedUntil: updated.suspendedUntil?.toISOString() ?? null,
    bio: updated.bio,
  };
}
