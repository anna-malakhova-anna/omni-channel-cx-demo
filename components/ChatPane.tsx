"use client";
import { useEffect, useRef, useState } from "react";
import { ChannelBadge, type Msg } from "./shared";

export interface ChatState { session?: string; who: string | null; msgs: Msg[] }

export default function ChatPane({ state, setState }: { state: ChatState; setState: (f: (s: ChatState) => ChatState) => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [state.msgs, busy]);

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
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div>
          <h2 className="font-semibold">Web chat</h2>
          <p className="text-xs text-zinc-500">Northgate Bank</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs ${state.who ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
          {state.who ? `✓ Verified: ${state.who}` : "Not verified"}
        </span>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {state.msgs.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === "customer" ? "items-end" : "items-start"}`}>
            {m.channel !== "chat" && <ChannelBadge channel={m.channel} />}
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.kind === "notice" ? "bg-amber-50 text-amber-900" : m.role === "customer" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"}`}>{m.text}</div>
          </div>
        ))}
        {busy && <p className="text-xs text-zinc-500">Agent is typing…</p>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message" className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700" />
        <button disabled={busy || !input.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40">Send</button>
      </form>
    </section>
  );
}
