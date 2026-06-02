import { prisma } from "../../clients/prisma.js";
import * as repo from "./announcement.repository.js";
import { paginate, buildPage } from "../../shared/pagination.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/errors.js";

function publicAnnouncement(a) {
  return {
    id: a.id,
    driverId: a.driverId,
    routeId: a.routeId,
    departureTime: a.departureTime.toISOString(),
    availableSeats: a.availableSeats,
    pricePerSeat: Number(a.pricePerSeat),
    status: a.status,
    note: a.note,
    expiresAt: a.expiresAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    route: a.route
      ? {
          id: a.route.id,
          distanceKm: a.route.distanceKm,
          estimatedDurationMin: a.route.estimatedDurationMin,
          fromRegion: { id: a.route.fromRegion.id, name: a.route.fromRegion.name },
          toRegion: { id: a.route.toRegion.id, name: a.route.toRegion.name },
        }
      : undefined,
    driver: a.driver
      ? {
          id: a.driver.id,
          firstName: a.driver.firstName,
          lastName: a.driver.lastName,
          avatarUrl: a.driver.avatarUrl,
          avgRating: a.driver.driverProfile?.avgRating
            ? Number(a.driver.driverProfile.avgRating)
            : null,
          totalRatings: a.driver.driverProfile?.totalRatings ?? 0,
        }
      : undefined,
  };
}

export async function create(driverId, { routeId, departureTime, availableSeats, pricePerSeat, note }) {
  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route || !route.isActive) {
    throw new BadRequestError("Route not found or inactive", "ROUTE_NOT_FOUND");
  }
  const created = await repo.create({
    driverId,
    routeId,
    departureTime,
    availableSeats,
    pricePerSeat,
    note: note ?? null,
    expiresAt: departureTime,
  });
  return publicAnnouncement(created);
}

export async function listFeed(query) {
  const { skip, take } = paginate(query);
  const [items, total] = await Promise.all([
    repo.listFeed(query, { skip, take }),
    repo.countFeed(query),
  ]);
  return buildPage({
    items: items.map(publicAnnouncement),
    total,
    page: query.page,
    limit: query.limit,
  });
}

export async function listMine(driverId, query) {
  const { skip, take } = paginate(query);
  const [items, total] = await Promise.all([
    repo.listMine({ driverId, status: query.status }, { skip, take }),
    repo.countMine({ driverId, status: query.status }),
  ]);
  return buildPage({
    items: items.map(publicAnnouncement),
    total,
    page: query.page,
    limit: query.limit,
  });
}

export async function getById(id) {
  const a = await repo.findById(id);
  if (!a) throw new NotFoundError("Announcement not found", "ANNOUNCEMENT_NOT_FOUND");
  return publicAnnouncement(a);
}

export async function update(driverId, id, data) {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Announcement not found", "ANNOUNCEMENT_NOT_FOUND");
  if (existing.driverId !== driverId) throw new ForbiddenError("Not your announcement", "FORBIDDEN");
  if (existing.status !== "ACTIVE") {
    throw new BadRequestError("Only active announcements can be edited", "INVALID_STATE");
  }
  const patch = { ...data };
  if (data.departureTime) patch.expiresAt = data.departureTime;
  return publicAnnouncement(await repo.update(id, patch));
}

export async function cancel(driverId, id) {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Announcement not found", "ANNOUNCEMENT_NOT_FOUND");
  if (existing.driverId !== driverId) throw new ForbiddenError("Not your announcement", "FORBIDDEN");
  if (existing.status !== "ACTIVE") {
    throw new BadRequestError("Announcement is not active", "INVALID_STATE");
  }
  return publicAnnouncement(await repo.update(id, { status: "CANCELLED" }));
}
