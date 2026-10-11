"use client";
import { useState } from "react";
import ChatPane, { type ChatState } from "./ChatPane";
import DeskPane from "./DeskPane";
import SmsPane from "./SmsPane";
import VoicePane from "./VoicePane";
import { GREETING, applyResume, redeem } from "./shared";

export default function Demo() {
  const [chat, setChat] = useState<ChatState>({ who: null, msgs: [GREETING] });
  const update = (r: { sessionToken: string; customerName: string | null }) => setChat((s) => ({ ...s, session: r.sessionToken, who: r.customerName }));

  async function tapLink(token: string) {
    setChat(applyResume(await redeem(token)));
  }
  async function reset() {
    await fetch("/api/reset", { method: "POST" });
    window.location.reload(); // simplest way to clear every pane's local state
  }

  const pane = "h-[600px] min-[1200px]:h-[clamp(520px,calc(100dvh-300px),720px)]";

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pb-6 pt-5 min-[760px]:px-8">
      <header className="flex h-16 items-center justify-between rounded-full bg-bg1 pl-4 pr-3" style={{ border: "var(--border-dark)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-ink" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 19V5l12 14V5" /></svg>
          </span>
          <span className="text-[17px] font-medium tracking-[-0.01em]">Proud North</span>
          <span className="hidden text-[15px] text-ondark-muted min-[760px]:inline">Omnichannel agent demo</span>
        </div>
        <button onClick={reset} className="btn-secondary">Reset demo</button>
      </header>

      <div className="px-1 pb-5 pt-7">
        <p className="text-[13px] uppercase tracking-[0.08em] text-warm">Simulated demo</p>
        <h1 className="mt-1 text-[clamp(32px,4vw,56px)] font-normal leading-[1.05] tracking-[-0.03em]">One agent. Every channel. No repeating yourself.</h1>
        <p className="mt-2 max-w-3xl text-[17px] text-ondark-muted">Call, get a text, continue in chat, reach a human. Verified once, with the whole story carried across. Fictional bank, synthetic data.</p>
      </div>

      <main className="grid grid-cols-1 gap-5 min-[760px]:grid-cols-2 min-[1200px]:grid-cols-4">
        <div className={pane}><VoicePane session={chat.session} onUpdate={update} /></div>
        <div className={pane}><SmsPane onTapLink={tapLink} session={chat.session} onReplyDone={update} /></div>
        <div className={pane}><ChatPane state={chat} setState={setChat} /></div>
        <div className={pane}><DeskPane /></div>
      </main>
    </div>
  );
}
