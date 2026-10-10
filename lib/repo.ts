import seed from "@/data/seed.json";
import type { Card, Customer, Dispute, LinkToken, SeedData, Ticket, TimelineEntry, Transaction } from "./types";

/**
 * Everything the agent needs from the "bank". A real rollout would implement this
 * against core banking + CRM/helpdesk APIs; the orchestrator and tools never know the difference.
 */
export interface BankRepository {
  findCustomerByName(fullName: string): Customer | undefined;
  getCustomer(id: string): Customer | undefined;
  getActiveCards(customerId: string): Card[];
  getTransactions(customerId: string): (Transaction & { cardLast4: string })[];
  getTransaction(id: string): (Transaction & { customerId: string }) | undefined;
  createDispute(d: Omit<Dispute, "id" | "createdAt" | "status">): Dispute;
  getDisputes(customerId: string): Dispute[];
  createTicket(t: Omit<Ticket, "id" | "createdAt" | "status">): Ticket;
  getTickets(): Ticket[];
  appendTimeline(e: Omit<TimelineEntry, "id" | "timestamp">): TimelineEntry;
  getTimeline(customerId: string): TimelineEntry[];
  saveLinkToken(t: LinkToken): void;
  getLinkToken(token: string): LinkToken | undefined;
  markLinkTokenUsed(token: string): void;
  reset(): void;
}

export class InMemoryRepository implements BankRepository {
  private d!: SeedData;
  private seq = 0;
  constructor() { this.reset(); }

  reset() { this.d = structuredClone(seed) as SeedData; this.seq = 0; }
  private id(prefix: string) { return `${prefix}_${Date.now().toString(36)}${(this.seq++).toString(36)}`; }

  findCustomerByName(fullName: string) {
    const n = fullName.trim().toLowerCase().replace(/\s+/g, " ");
    return this.d.customers.find((c) => c.fullName.toLowerCase() === n);
  }
  getCustomer(id: string) { return this.d.customers.find((c) => c.id === id); }
  getActiveCards(customerId: string) { return this.d.cards.filter((c) => c.customerId === customerId && c.status === "active"); }
  getTransactions(customerId: string) {
    const cards = this.d.cards.filter((c) => c.customerId === customerId);
    return this.d.transactions
      .filter((t) => cards.some((c) => c.id === t.cardId))
      .map((t) => ({ ...t, cardLast4: cards.find((c) => c.id === t.cardId)!.last4 }));
  }
  getTransaction(id: string) {
    const t = this.d.transactions.find((x) => x.id === id);
    const card = t && this.d.cards.find((c) => c.id === t.cardId);
    return t && card ? { ...t, customerId: card.customerId } : undefined;
  }
  createDispute(x: Omit<Dispute, "id" | "createdAt" | "status">) {
    const dispute: Dispute = { ...x, id: "DSP-" + String(this.d.disputes.length + 1001), status: "open", createdAt: new Date().toISOString() };
    this.d.disputes.push(dispute);
    return dispute;
  }
  getDisputes(customerId: string) { return this.d.disputes.filter((x) => x.customerId === customerId); }
  createTicket(x: Omit<Ticket, "id" | "createdAt" | "status">) {
    const ticket: Ticket = { ...x, id: "TKT-" + String(this.d.tickets.length + 5001), status: "open", createdAt: new Date().toISOString() };
    this.d.tickets.push(ticket);
    return ticket;
  }
  getTickets() { return this.d.tickets; }
  appendTimeline(e: Omit<TimelineEntry, "id" | "timestamp">) {
    const entry: TimelineEntry = { ...e, id: this.id("tl"), timestamp: new Date().toISOString() };
    this.d.timeline.push(entry);
    return entry;
  }
  getTimeline(customerId: string) { return this.d.timeline.filter((e) => e.customerId === customerId); }
  saveLinkToken(t: LinkToken) { this.d.linkTokens.push(t); }
  getLinkToken(token: string) { return this.d.linkTokens.find((t) => t.token === token); }
  markLinkTokenUsed(token: string) {
    const t = this.getLinkToken(token);
    if (t) t.usedAt = new Date().toISOString();
  }
}

// Survive Next.js dev hot-reloads: one store per server process.
const g = globalThis as unknown as { __repo?: BankRepository };
export const repo: BankRepository = (g.__repo ??= new InMemoryRepository());
