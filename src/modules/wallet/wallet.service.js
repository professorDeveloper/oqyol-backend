import { prisma } from "../../clients/prisma.js";
import * as repo from "./wallet.repository.js";
import { paginate, buildPage } from "../../shared/pagination.js";
import { BadRequestError, NotFoundError } from "../../shared/errors.js";

function publicWallet(w) {
  return {
    balance: Number(w.balance),
    heldAmount: Number(w.heldAmount),
  };
}

function publicTransaction(t) {
  return {
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    description: t.description,
    referenceId: t.referenceId,
    createdAt: t.createdAt.toISOString(),
  };
}

export async function getDriverBalance(userId) {
  const wallet = await repo.findWallet(userId);
  return wallet ? Number(wallet.balance) : 0;
}

// ── user-facing wallet (driver/passenger app) ─────────────────────────────

export async function getMyWallet(userId) {
  const wallet = await repo.getOrCreateWallet(userId);
  return publicWallet(wallet);
}

export async function listMyTransactions(userId, query) {
  const wallet = await repo.getOrCreateWallet(userId);
  const { skip, take } = paginate(query);
  const { items, total } = await repo.listTransactions(wallet.id, { skip, take });
  return buildPage({
    items: items.map(publicTransaction),
    total,
    page: query.page,
    limit: query.limit,
  });
}

export async function adminAdjust(userId, { amount, description }) {
  return prisma.$transaction(async (tx) => {
    const wallet = await repo.getOrCreateWallet(userId, tx);
    if (amount < 0 && Number(wallet.balance) + amount < 0) {
      throw new BadRequestError("Insufficient balance for negative adjustment", "INSUFFICIENT_BALANCE");
    }
    const updated = await repo.adjustBalance(wallet.id, amount, tx);
    await repo.createTransaction(
      {
        walletId: wallet.id,
        type: amount >= 0 ? "BONUS" : "CAPTURE",
        amount,
        description,
      },
      tx
    );
    return publicWallet(updated);
  });
}

// ── internal commission ops, used by orders module ────────────────────────

export async function holdCommission(tx, { userId, orderId, amount }) {
  const wallet = await repo.getOrCreateWallet(userId, tx);
  if (Number(wallet.balance) < amount) {
    throw new BadRequestError(
      "Insufficient driver wallet balance to accept this order",
      "INSUFFICIENT_BALANCE"
    );
  }
  await repo.adjustBalance(wallet.id, -amount, tx);
  await repo.adjustHeld(wallet.id, amount, tx);
  await repo.createTransaction(
    {
      walletId: wallet.id,
      type: "HOLD",
      amount: -amount,
      description: "Commission hold",
      referenceId: orderId,
    },
    tx
  );
  return tx.commissionHold.create({
    data: { orderId, walletId: wallet.id, amount, status: "HELD" },
  });
}

export async function captureCommission(tx, { orderId }) {
  const hold = await tx.commissionHold.findUnique({ where: { orderId } });
  if (!hold) throw new NotFoundError("Commission hold not found", "HOLD_NOT_FOUND");
  if (hold.status !== "HELD") return hold;
  await repo.adjustHeld(hold.walletId, -Number(hold.amount), tx);
  await repo.createTransaction(
    {
      walletId: hold.walletId,
      type: "CAPTURE",
      amount: -Number(hold.amount),
      description: "Commission captured (ride completed)",
      referenceId: orderId,
    },
    tx
  );
  return tx.commissionHold.update({
    where: { orderId },
    data: { status: "CAPTURED", resolvedAt: new Date() },
  });
}

export async function releaseCommission(tx, { orderId }) {
  const hold = await tx.commissionHold.findUnique({ where: { orderId } });
  if (!hold || hold.status !== "HELD") return hold;
  await repo.adjustHeld(hold.walletId, -Number(hold.amount), tx);
  await repo.adjustBalance(hold.walletId, Number(hold.amount), tx);
  await repo.createTransaction(
    {
      walletId: hold.walletId,
      type: "RELEASE",
      amount: Number(hold.amount),
      description: "Commission released (order cancelled)",
      referenceId: orderId,
    },
    tx
  );
  return tx.commissionHold.update({
    where: { orderId },
    data: { status: "RELEASED", resolvedAt: new Date() },
  });
}
