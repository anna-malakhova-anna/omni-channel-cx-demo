import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { Channel } from "./types";

export const MAX_VERIFY_ATTEMPTS = 3;

/** Server-side session: the trust boundary. The client only ever holds the opaque id. */
export interface Session {
  id: string;
  channel: Channel;
  customerId?: string;
  failedAttempts: number;
  messages: Anthropic.MessageParam[];
  /** Turns before verification; flushed to the customer's timeline once we know who they are. */
  pendingTimeline: { channel: Channel; role: "customer" | "agent" | "tool"; content: string }[];
}

const g = globalThis as unknown as { __sessions?: Map<string, Session> };
const store = (g.__sessions ??= new Map<string, Session>());

export function createSession(channel: Channel, customerId?: string): Session {
  const s: Session = { id: randomUUID(), channel, customerId, failedAttempts: 0, messages: [], pendingTimeline: [] };
  store.set(s.id, s);
  return s;
}
export const getSession = (id: string) => store.get(id);
export const resetSessions = () => store.clear();
