"use client";
import { useEffect, useState } from "react";
import { CHANNEL_META } from "./shared";

interface Ticket {
  id: string; createdAt: string; summary: string;
  customer: { fullName: string; phone: string; email: string } | null;
  dispute: { id: string; status: string; note: string; merchant?: string; amount?: number; currency?: string } | null;
  timeline: { id: string; channel: string; role: string; content: string; timestamp: string }[];
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h2 className="font-semibold">Agent desk</h2>
        <p className="text-xs text-zinc-500">Human specialist queue</p>
      </header>
      {!t ? (
        <p className="pt-10 text-center text-xs text-zinc-400">No tickets yet. They appear when the agent escalates.</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3 text-sm">
          {tickets.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {tickets.map((x) => (
                <button key={x.id} onClick={() => setOpen(x.id)} className={`rounded-full px-2.5 py-0.5 text-xs ${x.id === t.id ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-700"}`}>{x.id}</button>
              ))}
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{t.customer?.fullName ?? "Unverified customer"}</p>
              <p className="text-xs text-zinc-500">{t.customer ? `${t.customer.phone} · ${t.customer.email}` : "Identity not verified; verify before sharing account details"}</p>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t.id} · open</span>
          </div>
          {t.dispute ? (
            <div className="rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
              <p className="font-medium">{t.dispute.id} · dispute {t.dispute.status}</p>
              <p>{t.dispute.merchant} · ${t.dispute.amount?.toFixed(2)} {t.dispute.currency}</p>
              <p className="text-zinc-500">&ldquo;{t.dispute.note}&rdquo;</p>
            </div>
          ) : <p className="text-xs text-zinc-500">No dispute linked.</p>}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Agent summary</p>
            <p>{t.summary}</p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Cross-channel timeline</p>
            {t.timeline.length === 0 && <p className="text-xs text-zinc-400">No history (customer was never verified).</p>}
            <ol className="space-y-1.5">
              {t.timeline.map((e) => e.role === "tool" ? (
                <li key={e.id} className="pl-6 text-[11px] text-zinc-400">⚙ {e.content} · {time(e.timestamp)}</li>
              ) : (
                <li key={e.id} className="flex gap-2 text-xs">
                  <span title={CHANNEL_META[e.channel]?.label} className="w-4 shrink-0 text-center">{CHANNEL_META[e.channel]?.icon ?? "•"}</span>
                  <span><b className="font-medium">{e.role === "customer" ? "Customer" : "Agent"}</b> <span className="text-zinc-400">{time(e.timestamp)}</span><br />{e.content}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
