"use client";
import { useEffect, useRef, useState } from "react";

const MAYA = "cus_maya";
interface Sms { id: string; from: "bank" | "me"; text: string }

export default function SmsPane({ onTapLink, session, onReplyDone }: { onTapLink: (token: string) => void; session?: string; onReplyDone: (r: { sessionToken: string; customerName: string | null }) => void }) {
  const [msgs, setMsgs] = useState<Sms[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // Poll the "carrier" for link texts sent by the agent's send_secure_link tool.
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const { messages } = await fetch(`/api/sms?customerId=${MAYA}`).then((r) => r.json());
      const fresh = (messages as { id: string; text: string }[]).filter((m) => !seen.current.has(m.id));
      fresh.forEach((m) => seen.current.add(m.id));
      if (fresh.length) {
        // Slide in as a notification banner, then settle into the thread.
        setBanner("Secure link from Proud North");
        clearTimeout(hide);
        hide = setTimeout(() => {
          setBanner(null);
          setMsgs((s) => [...s, ...fresh.map((m) => ({ id: m.id, from: "bank" as const, text: m.text }))]);
        }, 2600);
      }
    };
    tick();
    const t = setInterval(tick, 1500);
    return () => { clearInterval(t); clearTimeout(hide); };
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
    return <>{hit[1]}<button onClick={() => onTapLink(hit[3])} className="break-all text-left font-medium text-[#1F5F8B] underline decoration-ch-sms decoration-2 underline-offset-2">{hit[2].slice(0, 38)}…</button></>;
  };

  return (
    <section aria-label="SMS" className="mx-auto flex h-full min-h-0 w-full max-w-[320px] flex-col rounded-[36px] border-[8px] border-[#0A0E0D] bg-card text-onlight shadow-card">
      <div className="flex items-center justify-between px-5 pt-2 text-xs font-medium"><span>9:41</span><span aria-hidden="true">▂▄▆ 5G</span></div>
      <div className="relative border-b border-card-border pb-2 text-center">
        <p className="text-[15px] font-medium">Proud North</p>
        <p className="text-[13px] text-onlight-muted">Text message · Maya&apos;s phone</p>
        {banner && (
          <div className="banner-in absolute inset-x-2 top-0 z-10 rounded-2xl bg-bg1 px-3 py-2 text-left text-[13px] text-ondark shadow-card" role="status">
            <span className="font-medium">Proud North</span> · now<br />{banner}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
        {msgs.length === 0 && <p className="pt-8 text-center text-[13px] text-onlight-muted">No messages yet</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble-in flex ${m.from === "me" ? "justify-end" : ""}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-bubble px-3 py-2 text-[15px] leading-snug ${m.from === "me" ? "bg-bubble-customer" : "bg-[#E1E4DF]"}`}>{body(m)}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={reply} className="flex gap-1.5 border-t border-card-border p-2">
        <input aria-label="Text message" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text message" className="min-w-0 flex-1 rounded-full border border-card-border bg-white px-3 py-1.5 text-[15px] outline-none placeholder:text-onlight-muted" />
        <button disabled={busy || !input.trim()} aria-label="Send" className="btn-primary !h-9 !px-3">↑</button>
      </form>
      <button onClick={() => fetch("/api/demo/expired-link", { method: "POST", body: JSON.stringify({ customerId: MAYA }) })} className="pb-2 text-[13px] text-onlight-muted underline">Demo: send an expired link</button>
    </section>
  );
}
