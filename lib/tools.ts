import type Anthropic from "@anthropic-ai/sdk";
import type { BankRepository } from "./repo";
import { MAX_VERIFY_ATTEMPTS, type Session } from "./sessions";
import { mintLinkToken } from "./tokens";

type Input = Record<string, unknown>;
export type ToolResult = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const maskPhone = (p: string) => "•••" + p.slice(-4);
const money = (n: number) => n.toFixed(2);

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "verify_customer",
    description: "Verify the customer's identity with their full name and the last 4 digits of their card. Must succeed before any other account tool. Only 3 attempts per session.",
    input_schema: { type: "object", properties: { fullName: { type: "string" }, cardLast4: { type: "string", description: "Exactly 4 digits" } }, required: ["fullName", "cardLast4"] },
  },
  {
    name: "get_transactions",
    description: "Look up the verified customer's recent card transactions, newest first.",
    input_schema: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        filter: { type: "object", properties: { merchant: { type: "string", description: "Case-insensitive substring" }, minAmount: { type: "number" }, maxAmount: { type: "number" }, limit: { type: "number" } } },
      },
      required: ["customerId"],
    },
  },
  {
    name: "send_secure_link",
    description: "Text the customer a single-use secure link (valid 15 minutes) that opens an authenticated chat. You will NOT see the URL, and must never try to say one. Tell the customer you are sending a text.",
    input_schema: { type: "object", properties: { customerId: { type: "string" }, purpose: { type: "string", enum: ["add_dispute_details"] } }, required: ["customerId", "purpose"] },
  },
  {
    name: "open_dispute",
    description: "Open a dispute on a transaction. ONLY call after you have shown the customer a summary (transaction, amount, their note) and they explicitly agreed in their latest message. Pass their confirming words verbatim in customerConfirmation.",
    input_schema: {
      type: "object",
      properties: {
        customerId: { type: "string" }, transactionId: { type: "string" },
        reason: { type: "string", description: "e.g. unrecognized_charge" }, note: { type: "string", description: "Customer's details, in their words" },
        customerConfirmation: { type: "string", description: "Verbatim words from the customer's latest message confirming the summary" },
      },
      required: ["customerId", "transactionId", "reason", "note", "customerConfirmation"],
    },
  },
  {
    name: "escalate",
    description: "Hand off to a human agent by creating a ticket. Write a 2–3 sentence summary of who the customer is, what they need and what has been done. Allowed even if the customer is not verified (e.g. after failed verification).",
    input_schema: { type: "object", properties: { customerId: { type: "string", description: "Omit if the customer is not verified" }, reason: { type: "string" }, summary: { type: "string" } }, required: ["reason", "summary"] },
  },
];

export interface ToolContext {
  repo: BankRepository;
  session: Session;
  /** The customer's latest message text; used to check confirmation claims. */
  lastCustomerMessage: string;
}

export function runTool(name: string, input: Input, ctx: ToolContext): ToolResult {
  const { repo, session } = ctx;

  if (name === "verify_customer") {
    if (session.customerId) return { ok: true, alreadyVerified: true, customerId: session.customerId };
    if (session.failedAttempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, locked: true, message: "Too many failed attempts. Do not retry; offer to escalate to a human." };
    const customer = repo.findCustomerByName(str(input.fullName));
    const last4 = str(input.cardLast4);
    // Same message whether the name or the digits were wrong: don't reveal which.
    if (!customer || !repo.getActiveCards(customer.id).some((c) => c.last4 === last4)) {
      session.failedAttempts++;
      const left = MAX_VERIFY_ATTEMPTS - session.failedAttempts;
      return left > 0
        ? { ok: false, attemptsRemaining: left, message: "Those details don't match our records. Ask the customer to try again." }
        : { ok: false, locked: true, message: "Too many failed attempts. Do not retry; offer to escalate to a human." };
    }
    session.customerId = customer.id;
    return { ok: true, customerId: customer.id, firstName: customer.fullName.split(" ")[0] };
  }

  if (name === "escalate") {
    // Unverified escalation is allowed (the failed-verification path), so no auth gate here.
    const customerId = session.customerId ?? null;
    const dispute = customerId ? repo.getDisputes(customerId).at(-1) : undefined;
    const ticket = repo.createTicket({ customerId, disputeId: dispute?.id, summary: str(input.summary) || str(input.reason) });
    return { ok: true, ticketId: ticket.id, disputeLinked: dispute?.id ?? null };
  }

  // Everything below needs a verified session, and the model can only act on that customer.
  if (!session.customerId) return { ok: false, error: "not_verified", message: "Customer is not verified. Call verify_customer first." };
  if (str(input.customerId) !== session.customerId) return { ok: false, error: "customer_mismatch", message: "customerId does not match the verified customer." };
  const customerId = session.customerId;

  if (name === "get_transactions") {
    const f = (input.filter ?? {}) as { merchant?: string; minAmount?: number; maxAmount?: number; limit?: number };
    let rows = repo.getTransactions(customerId).sort((a, b) => b.date.localeCompare(a.date));
    if (f.merchant) rows = rows.filter((t) => t.merchant.toLowerCase().includes(f.merchant!.toLowerCase()));
    if (typeof f.minAmount === "number") rows = rows.filter((t) => t.amount >= f.minAmount!);
    if (typeof f.maxAmount === "number") rows = rows.filter((t) => t.amount <= f.maxAmount!);
    const out = rows.slice(0, Math.min(f.limit ?? 10, 25)).map((t) => ({ id: t.id, date: t.date, merchant: t.merchant, amount: t.amount, currency: t.currency, status: t.status, cardLast4: t.cardLast4 }));
    return out.length ? { ok: true, transactions: out } : { ok: true, transactions: [], message: "No transaction matches those filters." };
  }

  if (name === "send_secure_link") {
    const customer = repo.getCustomer(customerId)!;
    const token = mintLinkToken(repo, customerId, str(input.purpose) || "add_dispute_details");
    const base = process.env.APP_URL || "http://localhost:3000";
    // Delivery = the SMS pane reads this from the timeline. The URL never goes back to the model.
    repo.appendTimeline({ customerId, channel: "sms", role: "agent", content: `Northgate Bank: tap to securely add details to your dispute (link expires in 15 min): ${base}/chat?t=${token}` });
    return { ok: true, sentTo: maskPhone(customer.phone), expiresInMinutes: 15 };
  }

  if (name === "open_dispute") {
    const txn = repo.getTransaction(str(input.transactionId));
    if (!txn || txn.customerId !== customerId) return { ok: false, error: "no_such_transaction", message: "No transaction matches that id for this customer." };
    const quote = str(input.customerConfirmation).toLowerCase();
    if (!quote || !ctx.lastCustomerMessage.toLowerCase().includes(quote))
      return { ok: false, error: "not_confirmed", message: "The customer has not confirmed in their latest message. Summarize the dispute and ask for an explicit yes first." };
    if (repo.getDisputes(customerId).some((d) => d.transactionId === txn.id))
      return { ok: false, error: "already_disputed", message: "A dispute is already open for this transaction." };
    const d = repo.createDispute({ transactionId: txn.id, customerId, reason: str(input.reason), customerNote: str(input.note) });
    return { ok: true, disputeId: d.id, status: d.status, amount: money(txn.amount), merchant: txn.merchant };
  }

  return { ok: false, error: "unknown_tool", message: `No tool named ${name}.` };
}
