import { prisma } from "../../clients/prisma.js";

export function getOrCreateWallet(userId, tx = prisma) {
  return tx.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export function findWallet(userId, tx = prisma) {
  return tx.wallet.findUnique({ where: { userId } });
}

export function adjustBalance(walletId, delta, tx = prisma) {
  return tx.wallet.update({
    where: { id: walletId },
    data: { balance: { increment: delta } },
  });
}

export function adjustHeld(walletId, delta, tx = prisma) {
  return tx.wallet.update({
    where: { id: walletId },
    data: { heldAmount: { increment: delta } },
  });
}

export function createTransaction(data, tx = prisma) {
  return tx.walletTransaction.create({ data });
}

export async function listTransactions(walletId, { skip, take }, tx = prisma) {
  const [items, total] = await Promise.all([
    tx.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    tx.walletTransaction.count({ where: { walletId } }),
  ]);
  return { items, total };
}
