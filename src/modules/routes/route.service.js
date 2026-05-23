import * as repo from "./route.repository.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors.js";

function publicRoute(r) {
  return {
    id: r.id,
    fromRegionId: r.fromRegionId,
    toRegionId: r.toRegionId,
    distanceKm: r.distanceKm,
    estimatedDurationMin: r.estimatedDurationMin,
    basePrice: Number(r.basePrice),
    isActive: r.isActive,
    fromRegion: r.fromRegion,
    toRegion: r.toRegion,
  };
}

function ensureRegionsDiffer(data) {
  if (data.fromRegionId && data.toRegionId && data.fromRegionId === data.toRegionId) {
    throw new BadRequestError("fromRegionId and toRegionId must differ", "SAME_REGION");
  }
}

export async function listPublic(query) {
  const items = await repo.listActive(query);
  return items.map(publicRoute);
}

export async function listAdmin(query) {
  const items = await repo.listAll(query);
  return items.map(publicRoute);
}

export async function getById(id) {
  const r = await repo.findById(id);
  if (!r) throw new NotFoundError("Route not found", "ROUTE_NOT_FOUND");
  return publicRoute(r);
}

export async function create(data) {
  ensureRegionsDiffer(data);
  return publicRoute(await repo.create(data));
}

export async function update(id, data) {
  ensureRegionsDiffer(data);
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Route not found", "ROUTE_NOT_FOUND");
  return publicRoute(await repo.update(id, data));
}

export async function remove(id) {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Route not found", "ROUTE_NOT_FOUND");
  try {
    await repo.remove(id);
  } catch (err) {
    if (err.code === "P2003") {
      throw new ConflictError(
        "Route is referenced by orders/announcements. Deactivate it instead.",
        "ROUTE_IN_USE"
      );
    }
    throw err;
  }
  return { message: "Route deleted" };
}
