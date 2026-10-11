import type { ReactNode } from "react";
import type { Channel } from "@/lib/types";
import type { ChatState } from "./ChatPane";

export interface Msg {
  channel: Channel; role: "customer" | "agent"; text: string;
  kind?: "notice" | "divider";
  dim?: boolean;   // turns from before a channel switch
  ts?: string;     // ISO time, used for the resume divider
}

export const CHANNEL_META: Record<string, { label: string; color: string; ink: string; noun: string }> = {
  voice: { label: "Voice", color: "var(--ch-voice)", ink: "var(--ch-voice-ink)", noun: "call" },
  sms: { label: "SMS", color: "var(--ch-sms)", ink: "var(--ch-sms-ink)", noun: "text conversation" },
  chat: { label: "Chat", color: "var(--ch-chat)", ink: "var(--ch-chat-ink)", noun: "chat" },
  system: { label: "System", color: "var(--ch-system)", ink: "var(--ch-system-ink)", noun: "system" },
};

const PATHS: Record<string, ReactNode> = {
  voice: <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z" />,
  sms: <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
  chat: <path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5l2 3H8l2-3H5a2 2 0 0 1-2-2zm2 0v10h14V5z" fillRule="evenodd" />,
  system: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 5v-2l-2.1-.5a7 7 0 0 0-.7-1.7l1.1-1.9-1.4-1.4-1.9 1.1a7 7 0 0 0-1.7-.7L13 3h-2l-.5 2.1a7 7 0 0 0-1.7.7L6.9 4.7 5.5 6.1l1.1 1.9a7 7 0 0 0-.7 1.7L3.8 10.2v2l2.1.5c.1.6.4 1.2.7 1.7l-1.1 1.9 1.4 1.4 1.9-1.1c.5.3 1.1.6 1.7.7L11 19h2l.5-2.1c.6-.1 1.2-.4 1.7-.7l1.9 1.1 1.4-1.4-1.1-1.9c.3-.5.6-1.1.7-1.7z" />,
};

export function ChannelIcon({ channel, className = "h-4 w-4", dark = false }: { channel: string; className?: string; dark?: boolean }) {
  const m = CHANNEL_META[channel] ?? CHANNEL_META.system;
  return <svg viewBox="0 0 24 24" className={className} fill={dark ? m.color : m.ink} aria-hidden="true">{PATHS[channel] ?? PATHS.system}</svg>;
}

/** Icon + label, tinted at 18% of the channel colour. `onDark` uses the pastel; otherwise the darker ink twin. */
export function ChannelTag({ channel, onDark = false }: { channel: string; onDark?: boolean }) {
  const m = CHANNEL_META[channel];
  if (!m) return null;
  const c = onDark ? m.color : m.ink;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px]" style={{ color: c, background: `color-mix(in srgb, ${m.color} 18%, transparent)` }}>
      <ChannelIcon channel={channel} className="h-3 w-3" dark={onDark} />{m.label}
    </span>
  );
}

/** Shared header for the light conversation cards. */
export function CardHeader({ channel, title, live, right }: { channel: string; title: string; live?: boolean; right?: ReactNode }) {
  const m = CHANNEL_META[channel];
  return (
    <header className="flex items-center gap-3 border-b border-card-border pb-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${m.color} 25%, transparent)` }}>
        <ChannelIcon channel={channel} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[22px] font-medium leading-tight tracking-[-0.02em]">{title}</h2>
        <p className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-onlight-muted">
          <span className={`live-dot h-2 w-2 rounded-full bg-accent ${live ? "on" : "opacity-50"}`} aria-hidden="true" />
          Proud North AI agent
        </p>
      </div>
      {right}
    </header>
  );
}

export function Bubble({ role, children, dim, label }: { role: "customer" | "agent"; children: ReactNode; dim?: boolean; label?: string }) {
  const me = role === "customer";
  return (
    <div className={`bubble-in flex flex-col ${me ? "items-end" : "items-start"} ${dim ? "opacity-70" : ""}`}>
      <span className="mb-0.5 px-1 text-[13px] text-onlight-muted">{label ?? (me ? "You" : "Agent")}</span>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-bubble px-3.5 py-2 text-[15px] leading-snug text-onlight ${me ? "bg-bubble-customer" : "bg-bubble-agent"}`}>{children}</div>
    </div>
  );
}

export const clock = (iso?: string) =>
  (iso ? new Date(iso) : new Date()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();

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

export const GREETING: Msg = { channel: "chat", role: "agent", text: "Hi, I'm Proud North's virtual assistant. How can I help today?" };

type History = { channel: Channel; role: "customer" | "agent"; text: string; ts?: string }[];

/** Turn a /api/resume response into the next chat state: earlier turns dimmed, a divider, then the agent's pick-up line. */
export function applyResume(data: { ok: boolean; reason?: string; sessionToken?: string; customerName?: string; history?: History; reply?: string }): (s: ChatState) => ChatState {
  return (s) => {
    if (!data.ok) return { ...s, msgs: [...s.msgs, { channel: "chat", role: "agent", kind: "notice", text: FAILURE_COPY[data.reason ?? "invalid"] ?? FAILURE_COPY.invalid }] };
    const history = (data.history ?? []).map((h) => ({ ...h, dim: true }));
    const last = history.at(-1);
    const divider: Msg[] = last ? [{ channel: last.channel, role: "agent", kind: "divider", text: "", ts: last.ts }] : [];
    return { session: data.sessionToken, who: data.customerName ?? null, msgs: [...history, ...divider, { channel: "chat", role: "agent", text: data.reply ?? "" }] };
  };
}
