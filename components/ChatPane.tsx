"use client";
import { useEffect, useRef, useState } from "react";
import { Bubble, CHANNEL_META, CardHeader, ChannelTag, clock, type Msg } from "./shared";

export interface ChatState { session?: string; who: string | null; msgs: Msg[] }

export default function ChatPane({ state, setState }: { state: ChatState; setState: (f: (s: ChatState) => ChatState) => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [state.msgs, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setState((s) => ({ ...s, msgs: [...s.msgs, { channel: "chat", role: "customer", text }] }));
    setBusy(true);
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "chat", sessionToken: state.session, message: text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState((s) => ({ ...s, session: data.sessionToken, who: data.customerName, msgs: [...s.msgs, { channel: "chat", role: "agent", text: data.reply }] }));
    } catch (err) {
      setState((s) => ({ ...s, msgs: [...s.msgs, { channel: "chat", role: "agent", text: `⚠️ ${(err as Error).message || "Something went wrong."}` }] }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Web chat" className="flex h-full min-h-0 flex-col rounded-card border border-card-border bg-card p-4 text-onlight shadow-card">
      <CardHeader
        channel="chat" title="Chat" live={busy}
        right={<span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] ${state.who ? "bg-accent/30 text-[#244A22]" : "bg-black/5 text-onlight-muted"}`}>{state.who ? `Verified · ${state.who.split(" ")[0]}` : "Not verified"}</span>}
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
        {state.msgs.map((m, i) => {
          if (m.kind === "divider") {
            return (
              <div key={i} className="flex items-center gap-2 py-1 text-[13px] text-onlight-muted" role="separator">
                <span className="h-px flex-1 bg-card-border" />
                <ChannelTag channel={m.channel} />
                <span>Continued from your {CHANNEL_META[m.channel]?.noun} · {clock(m.ts)}</span>
                <span className="h-px flex-1 bg-card-border" />
              </div>
            );
          }
          if (m.kind === "notice") return <p key={i} className="bubble-in rounded-bubble bg-[#F3E3D6] px-3.5 py-2 text-[15px] text-[#5A3418]">{m.text}</p>;
          return (
            <div key={i} className="space-y-1">
              {m.dim && <div className={m.role === "customer" ? "text-right" : ""}><ChannelTag channel={m.channel} /></div>}
              <Bubble role={m.role} dim={m.dim}>{m.text}</Bubble>
            </div>
          );
        })}
        {busy && <p className="px-1 text-[13px] text-onlight-muted">Agent is typing…</p>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-card-border pt-3">
        <input aria-label="Message" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message" className="min-w-0 flex-1 rounded-full border border-card-border bg-white px-4 py-2 text-[15px] text-onlight outline-none placeholder:text-onlight-muted" />
        <button disabled={busy || !input.trim()} className="btn-primary">Send</button>
      </form>
    </section>
  );
}
