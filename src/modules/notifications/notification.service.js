import * as repo from "./notification.repository.js";
import { paginate, buildPage } from "../../shared/pagination.js";
import { NotFoundError } from "../../shared/errors.js";

function publicNotification(n) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    data: n.data ?? null,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listMy(userId, query) {
  const { skip, take } = paginate(query);
  const [items, total, unread] = await Promise.all([
    repo.listByUser({ userId, isRead: query.isRead }, { skip, take }),
    repo.countByUser({ userId, isRead: query.isRead }),
    repo.countUnreadByUser(userId),
  ]);
  return {
    ...buildPage({
      items: items.map(publicNotification),
      total,
      page: query.page,
      limit: query.limit,
    }),
    unreadTotal: unread,
  };
}

export async function markRead(id, userId) {
  const existing = await repo.findById(id);
  if (!existing || existing.userId !== userId) {
    throw new NotFoundError("Bildirishnoma topilmadi", "NOTIFICATION_NOT_FOUND");
  }
  await repo.markRead(id, userId);
  return { message: "O'qildi" };
}

export async function markAllRead(userId) {
  const result = await repo.markAllRead(userId);
  return { message: "Hammasi o'qildi", count: result.count };
}

// Boshqa modullar shu funksiya orqali notification yaratadi.
// Kelajakda push integratsiyasi shu yerga qo'shiladi.
export async function send({ userId, title, body, type, data }) {
  return publicNotification(await repo.create({ userId, title, body, type, data }));
}
