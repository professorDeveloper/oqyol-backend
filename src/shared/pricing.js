import { env } from "../config/env.js";

export function commissionAmount(finalPrice) {
  const rate = env.COMMISSION_RATE;
  const amount = Number(finalPrice) * rate;
  return Math.round(amount * 100) / 100;
}
