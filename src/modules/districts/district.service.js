import * as repo from "./district.repository.js";
import * as regionRepo from "../regions/region.repository.js";
import { NotFoundError } from "../../shared/errors.js";

function publicDistrict(d) {
  return {
    id: d.id,
    regionId: d.regionId,
    name: d.name,
    isActive: d.isActive,
  };
}

function publicDistrictWithRegion(d) {
  return {
    ...publicDistrict(d),
    region: d.region ? { id: d.region.id, name: d.region.name, code: d.region.code } : null,
  };
}

export async function listByRegion(regionId) {
  const region = await regionRepo.findById(regionId);
  if (!region) throw new NotFoundError("Region not found", "REGION_NOT_FOUND");
  const items = await repo.listByRegion(regionId);
  return items.map(publicDistrict);
}

export async function listAll() {
  const items = await repo.listAllActive();
  return items.map(publicDistrictWithRegion);
}

export async function getById(id) {
  const d = await repo.findById(id);
  if (!d) throw new NotFoundError("District not found", "DISTRICT_NOT_FOUND");
  return publicDistrictWithRegion(d);
}
