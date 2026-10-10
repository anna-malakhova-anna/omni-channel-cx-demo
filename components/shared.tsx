import type { Channel } from "@/lib/types";

export interface Msg { channel: Channel; role: "customer" | "agent"; text: string; kind?: "notice" }

export const CHANNEL_META: Record<string, { icon: string; label: string }> = {
  voice: { icon: "📞", label: "Voice" },
  sms: { icon: "💬", label: "SMS" },
  chat: { icon: "🖥️", label: "Chat" },
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  const m = CHANNEL_META[channel];
  if (!m) return null;
  return <span className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500">{m.icon} via {m.label}</span>;
}

/** Shared by /chat?t= and the SMS "tap": redeem a token and return what the chat pane needs, or a reason it failed. */
export async function redeem(token: string) {
  const res = await fetch("/api/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  return res.json();
}

export const FAILURE_COPY: Record<string, string> = {
  expired: "That link has expired (links last 15 minutes). Let's verify you again so I can help.",
  used: "That link was already used. Let's verify you again so I can help.",
  invalid: "That link isn't valid. Let's verify you again so I can help.",
};

export const GREETING: Msg = { channel: "chat", role: "agent", text: "Hi, I'm Northgate Bank's virtual assistant. How can I help today?" };

import type { ChatState } from "./ChatPane";
/** Turn a /api/resume response into the next chat state. */
export function applyResume(data: { ok: boolean; reason?: string; sessionToken?: string; customerName?: string; history?: { channel: Channel; role: "customer" | "agent"; text: string }[]; reply?: string }): (s: ChatState) => ChatState {
  return (s) => {
    if (!data.ok) return { ...s, msgs: [...s.msgs, { channel: "chat", role: "agent", kind: "notice", text: FAILURE_COPY[data.reason ?? "invalid"] ?? FAILURE_COPY.invalid }] };
    return { session: data.sessionToken, who: data.customerName ?? null, msgs: [...(data.history ?? []), { channel: "chat", role: "agent", text: data.reply ?? "" }] };
  };
}
