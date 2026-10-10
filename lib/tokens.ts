import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { BankRepository } from "./repo";

const TTL_MS = 15 * 60 * 1000;
// Dev fallback only; set LINK_SIGNING_SECRET in any shared environment.
const secret = () => process.env.LINK_SIGNING_SECRET || "dev-only-insecure-secret";
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function mintLinkToken(repo: BankRepository, customerId: string, purpose: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  const payload = Buffer.from(JSON.stringify({ jti: randomUUID(), cid: customerId, purpose, exp })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  repo.saveLinkToken({ token, customerId, purpose, expiresAt: new Date(exp).toISOString() });
  return token;
}

export type TokenCheck =
  | { ok: true; customerId: string; purpose: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Validates signature, existence, expiry, single use. Marks the token used on success. */
export function redeemLinkToken(repo: BankRepository, token: string, now = Date.now()): TokenCheck {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };
  const rec = repo.getLinkToken(token);
  if (!rec) return { ok: false, reason: "invalid" };
  if (rec.usedAt) return { ok: false, reason: "used" };
  if (Date.parse(rec.expiresAt) <= now) return { ok: false, reason: "expired" };
  repo.markLinkTokenUsed(token);
  return { ok: true, customerId: rec.customerId, purpose: rec.purpose };
}
