"use client";
import { useEffect, useState } from "react";
import { CHANNEL_META, ChannelIcon, ChannelTag, clock } from "./shared";

interface Ticket {
  id: string; createdAt: string; summary: string;
  customer: { fullName: string; phone: string; email: string } | null;
  dispute: { id: string; status: string; note: string; merchant?: string; amount?: number; currency?: string } | null;
  timeline: { id: string; channel: string; role: string; content: string; timestamp: string }[];
}

export default function DeskPane() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState<string>();

  useEffect(() => {
    const tick = () => fetch("/api/tickets").then((r) => r.json()).then((d) => setTickets(d.tickets)).catch(() => {});
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, []);

  const t = tickets.find((x) => x.id === open) ?? tickets[0];

  return (
    <section aria-label="Agent desk" className="flex h-full min-h-0 flex-col rounded-card bg-bg1 p-4 text-ondark shadow-card" style={{ border: "var(--border-dark)" }}>
      <header className="border-b border-white/10 pb-3">
        <h2 className="text-[22px] font-medium leading-tight tracking-[-0.02em]">Agent desk</h2>
        <p className="text-[13px] text-ondark-muted">Human specialist queue · internal</p>
      </header>
      {!t ? (
        <p className="pt-10 text-center text-[15px] text-ondark-muted">No escalations yet</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4" aria-live="polite">
          {tickets.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {tickets.map((x) => (
                <button key={x.id} onClick={() => setOpen(x.id)} aria-pressed={x.id === t.id} className={`rounded-full px-3 py-1 text-[13px] ${x.id === t.id ? "bg-accent text-accent-ink" : "border border-white/10 text-ondark"}`}>{x.id}</button>
              ))}
            </div>
          )}
          <div className="bubble-in rounded-2xl bg-white/5 p-3.5" style={{ border: "var(--border-dark)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[17px] font-medium">{t.customer?.fullName ?? "Unverified customer"}</p>
                <p className="text-[13px] text-ondark-muted">{t.customer ? `${t.customer.phone} · ${t.customer.email}` : "Identity not verified. Verify before sharing account details."}</p>
              </div>
              <span className="shrink-0 rounded-full bg-warm/20 px-2.5 py-0.5 text-[13px] text-warm">{t.id} · open</span>
            </div>
            {t.dispute ? (
              <div className="mt-3 text-[15px]">
                <p><span className="font-medium">{t.dispute.id}</span> <span className="ml-1 rounded-full bg-accent/20 px-2 py-0.5 text-[13px] text-accent">Dispute {t.dispute.status}</span></p>
                <p className="text-ondark-muted">{t.dispute.merchant} · ${t.dispute.amount?.toFixed(2)} {t.dispute.currency}</p>
                <p className="text-ondark-muted">&ldquo;{t.dispute.note}&rdquo;</p>
              </div>
            ) : <p className="mt-3 text-[13px] text-ondark-muted">No dispute linked.</p>}
            <p className="mt-3 text-[13px] text-ondark-muted">Agent summary</p>
            <p className="text-[15px] leading-snug">{t.summary}</p>
          </div>
          <div>
            <p className="mb-2 text-[13px] text-ondark-muted">Cross-channel timeline</p>
            {t.timeline.length === 0 && <p className="text-[13px] text-ondark-muted">No history. The customer was never verified.</p>}
            <ol className="space-y-2">
              {t.timeline.map((e) => (
                <li key={e.id} className="relative flex items-center gap-2 text-[13px]" title={e.content}>
                  <ChannelIcon channel={e.channel} dark className="h-4 w-4 shrink-0" />
                  <span className="w-[58px] shrink-0 text-ondark-muted">{clock(e.timestamp)}</span>
                  <span className="w-[62px] shrink-0 text-ondark-muted">{e.role === "customer" ? "Customer" : e.role === "agent" ? "Agent" : "System"}</span>
                  <span className={`min-w-0 flex-1 truncate ${e.role === "tool" ? "text-ondark-muted" : ""}`}>{e.content}</span>
                  <span className="sr-only">{CHANNEL_META[e.channel]?.label}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 flex flex-wrap gap-1.5" aria-label="Channels in this ticket">
              {Array.from(new Set(t.timeline.map((e) => e.channel).filter((c) => c !== "system"))).map((c) => <ChannelTag key={c} channel={c} onDark />)}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
