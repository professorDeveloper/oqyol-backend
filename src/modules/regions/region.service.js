import * as repo from "./region.repository.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";

function publicRegion(r) {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    radiusKm: r.radiusKm,
    isActive: r.isActive,
  };
}

export async function listPublic() {
  const items = await repo.listActive();
  return items.map(publicRegion);
}

export async function listAdmin() {
  const items = await repo.listAll();
  return items.map(publicRegion);
}

export async function getById(id) {
  const r = await repo.findById(id);
  if (!r) throw new NotFoundError("Region not found", "REGION_NOT_FOUND");
  return publicRegion(r);
}

export async function create(data) {
  return publicRegion(await repo.create(data));
}

export async function update(id, data) {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Region not found", "REGION_NOT_FOUND");
  return publicRegion(await repo.update(id, data));
}

export async function remove(id) {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Region not found", "REGION_NOT_FOUND");
  try {
    await repo.remove(id);
  } catch (err) {
    if (err.code === "P2003") {
      throw new ConflictError(
        "Region is referenced by routes. Delete or deactivate them first.",
        "REGION_IN_USE"
      );
    }
    throw err;
  }
  return { message: "Region deleted" };
}
