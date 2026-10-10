import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/lib/repo";
import { createSession } from "@/lib/sessions";
import { runTool } from "@/lib/tools";
import { mintLinkToken, redeemLinkToken } from "@/lib/tokens";

let repo: InMemoryRepository;
const ctx = (session = createSession("chat"), msg = "") => ({ repo, session, lastCustomerMessage: msg });
const verified = () => { const s = createSession("chat"); runTool("verify_customer", { fullName: "Maya Chen", cardLast4: "4417" }, ctx(s)); return s; };

beforeEach(() => { repo = new InMemoryRepository(); });

describe("verify_customer", () => {
  it("verifies Maya (case-insensitive name)", () => {
    const s = createSession("chat");
    expect(runTool("verify_customer", { fullName: " maya CHEN ", cardLast4: "4417" }, ctx(s)).ok).toBe(true);
    expect(s.customerId).toBe("cus_maya");
  });
  it("rejects wrong digits without saying which part failed, then locks after 3", () => {
    const s = createSession("chat");
    const r1 = runTool("verify_customer", { fullName: "Maya Chen", cardLast4: "0000" }, ctx(s));
    expect(r1).toMatchObject({ ok: false, attemptsRemaining: 2 });
    runTool("verify_customer", { fullName: "Nobody", cardLast4: "4417" }, ctx(s));
    expect(runTool("verify_customer", { fullName: "Maya Chen", cardLast4: "1111" }, ctx(s))).toMatchObject({ locked: true });
    // even correct details are refused once locked
    expect(runTool("verify_customer", { fullName: "Maya Chen", cardLast4: "4417" }, ctx(s))).toMatchObject({ ok: false, locked: true });
    expect(s.customerId).toBeUndefined();
  });
  it("does not accept another customer's card digits", () => {
    expect(runTool("verify_customer", { fullName: "Maya Chen", cardLast4: "9032" }, ctx()).ok).toBe(false);
  });
});

describe("account tools require verification", () => {
  it("refuses when unverified", () => {
    expect(runTool("get_transactions", { customerId: "cus_maya" }, ctx())).toMatchObject({ error: "not_verified" });
  });
  it("refuses another customer's id", () => {
    expect(runTool("get_transactions", { customerId: "cus_daniel" }, ctx(verified()))).toMatchObject({ error: "customer_mismatch" });
  });
});

describe("get_transactions", () => {
  it("finds the QuickMart charge and never exposes a full card number", () => {
    const r = runTool("get_transactions", { customerId: "cus_maya", filter: { merchant: "quickmart" } }, ctx(verified())) as { transactions: Record<string, unknown>[] };
    expect(r.transactions).toHaveLength(1);
    expect(r.transactions[0]).toMatchObject({ amount: 214.37, merchant: "QUICKMART ONLINE", cardLast4: "4417" });
    expect(Object.keys(r.transactions[0])).not.toContain("cardId");
  });
  it("returns a recoverable message when nothing matches", () => {
    expect(runTool("get_transactions", { customerId: "cus_maya", filter: { merchant: "zzz" } }, ctx(verified()))).toMatchObject({ ok: true, transactions: [], message: expect.stringContaining("No transaction") });
  });
});

describe("open_dispute", () => {
  const args = { customerId: "cus_maya", transactionId: "txn_007", reason: "unrecognized_charge", note: "Never shopped there", customerConfirmation: "yes, go ahead" };
  it("blocks without confirmation in the latest message", () => {
    expect(runTool("open_dispute", args, ctx(verified(), "I don't recognize it"))).toMatchObject({ error: "not_confirmed" });
    expect(repo.getDisputes("cus_maya")).toHaveLength(0);
  });
  it("creates a dispute once confirmed, and refuses duplicates", () => {
    const s = verified();
    const r = runTool("open_dispute", args, ctx(s, "Yes, go ahead please"));
    expect(r).toMatchObject({ ok: true, disputeId: expect.stringMatching(/^DSP-/) });
    expect(runTool("open_dispute", args, ctx(s, "yes, go ahead"))).toMatchObject({ error: "already_disputed" });
  });
  it("rejects another customer's transaction", () => {
    const other = repo.getTransactions("cus_daniel")[0].id;
    expect(runTool("open_dispute", { ...args, transactionId: other }, ctx(verified(), "yes, go ahead"))).toMatchObject({ error: "no_such_transaction" });
  });
});

describe("escalate", () => {
  it("links the dispute when one exists", () => {
    const s = verified();
    const d = runTool("open_dispute", { customerId: "cus_maya", transactionId: "txn_007", reason: "x", note: "y", customerConfirmation: "yes" }, ctx(s, "yes"));
    const t = runTool("escalate", { reason: "asked for human", summary: "Maya disputes a charge." }, ctx(s));
    expect(t).toMatchObject({ ok: true, disputeLinked: d.disputeId });
  });
  it("works unverified (failed-verification path) with a null customer", () => {
    runTool("escalate", { reason: "verification failed", summary: "Could not verify." }, ctx());
    expect(repo.getTickets()[0].customerId).toBeNull();
  });
});

describe("send_secure_link + tokens", () => {
  it("delivers to SMS timeline, keeps the URL away from the model, and is single-use", () => {
    const r = runTool("send_secure_link", { customerId: "cus_maya", purpose: "add_dispute_details" }, ctx(verified()));
    expect(JSON.stringify(r)).not.toContain("http");
    const sms = repo.getTimeline("cus_maya").find((e) => e.channel === "sms")!;
    const token = sms.content.split("?t=")[1];
    expect(redeemLinkToken(repo, token)).toMatchObject({ ok: true, customerId: "cus_maya" });
    expect(redeemLinkToken(repo, token)).toMatchObject({ ok: false, reason: "used" });
  });
  it("rejects expired, tampered and unknown tokens", () => {
    const t = mintLinkToken(repo, "cus_maya", "p", 0);
    expect(redeemLinkToken(repo, t, 16 * 60 * 1000)).toMatchObject({ reason: "expired" });
    const t2 = mintLinkToken(repo, "cus_maya", "p");
    const forged = Buffer.from(JSON.stringify({ cid: "cus_daniel", exp: Date.now() + 1e6 })).toString("base64url") + "." + t2.split(".")[1];
    expect(redeemLinkToken(repo, forged)).toMatchObject({ reason: "invalid" });
    expect(redeemLinkToken(repo, "garbage")).toMatchObject({ reason: "invalid" });
  });
});
