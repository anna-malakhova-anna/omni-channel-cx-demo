"use client";
import { useEffect, useRef, useState } from "react";

const MAYA = "cus_maya";
interface Sms { id: string; from: "bank" | "me"; text: string }

export default function SmsPane({ onTapLink, session, onReplyDone }: { onTapLink: (token: string) => void; session?: string; onReplyDone: (r: { sessionToken: string; customerName: string | null }) => void }) {
  const [msgs, setMsgs] = useState<Sms[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set<string>());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  // Poll the "carrier" for link texts sent by the agent's send_secure_link tool.
  useEffect(() => {
    const tick = async () => {
      const { messages } = await fetch(`/api/sms?customerId=${MAYA}`).then((r) => r.json());
      const fresh = (messages as { id: string; text: string }[]).filter((m) => !seen.current.has(m.id));
      fresh.forEach((m) => seen.current.add(m.id));
      if (fresh.length) setMsgs((s) => [...s, ...fresh.map((m) => ({ id: m.id, from: "bank" as const, text: m.text }))]);
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }, []);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((s) => [...s, { id: crypto.randomUUID(), from: "me", text }]);
    try {
      const data = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "sms", sessionToken: session, message: text }) }).then((r) => r.json());
      if (data.reply) { setMsgs((s) => [...s, { id: crypto.randomUUID(), from: "bank", text: data.reply }]); onReplyDone(data); }
    } finally { setBusy(false); }
  }

  const body = (m: Sms) => {
    const hit = m.text.match(/^([\s\S]*?)(https?:\/\/\S+\/chat\?t=(\S+))$/);
    if (!hit) return m.text;
    return <>{hit[1]}<button onClick={() => onTapLink(hit[3])} className="break-all text-left text-blue-600 underline">{hit[2].slice(0, 38)}…</button></>;
  };

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-[300px] flex-col rounded-[2rem] border-[6px] border-zinc-800 bg-white text-zinc-900">
      <div className="py-2 text-center text-xs font-medium">Northgate Bank<div className="text-[10px] font-normal text-zinc-500">Text message · Maya&apos;s phone</div></div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-zinc-50 px-2 py-2">
        {msgs.length === 0 && <p className="pt-8 text-center text-xs text-zinc-400">No messages yet</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-xs ${m.from === "me" ? "bg-blue-500 text-white" : "bg-zinc-200"}`}>{body(m)}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={reply} className="flex gap-1 border-t border-zinc-200 p-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text message" className="min-w-0 flex-1 rounded-full border border-zinc-300 px-3 py-1 text-xs outline-none" />
        <button disabled={busy || !input.trim()} className="rounded-full bg-blue-500 px-3 text-xs text-white disabled:opacity-40">↑</button>
      </form>
      <button onClick={() => fetch("/api/demo/expired-link", { method: "POST", body: JSON.stringify({ customerId: MAYA }) })} className="pb-2 text-[10px] text-zinc-400 underline">demo: send an expired link</button>
    </section>
  );
}
