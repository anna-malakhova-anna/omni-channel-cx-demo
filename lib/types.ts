export type Channel = "voice" | "sms" | "chat" | "system";
export type Role = "customer" | "agent" | "tool";

export interface Customer { id: string; fullName: string; phone: string; email: string; preferredChannel: Exclude<Channel, "system">; }
export interface Card { id: string; customerId: string; last4: string; status: string; }
export interface Transaction { id: string; cardId: string; date: string; merchant: string; amount: number; currency: string; status: string; }
export interface Dispute { id: string; transactionId: string; customerId: string; reason: string; customerNote: string; status: "open"; createdAt: string; }
export interface Ticket { id: string; customerId: string | null; disputeId?: string; summary: string; status: "open"; createdAt: string; }
export interface TimelineEntry { id: string; customerId: string; channel: Channel; role: Role; content: string; timestamp: string; }
export interface LinkToken { token: string; customerId: string; purpose: string; expiresAt: string; usedAt?: string; }

export interface SeedData {
  customers: Customer[]; cards: Card[]; transactions: Transaction[];
  disputes: Dispute[]; tickets: Ticket[]; timeline: TimelineEntry[]; linkTokens: LinkToken[];
}
