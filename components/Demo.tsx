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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-1 text-xs text-amber-900">
        <span>Northgate Bank is fictional. All data is synthetic and every channel is simulated.</span>
        <button onClick={reset} className="shrink-0 rounded border border-amber-300 px-2 py-0.5 hover:bg-amber-100">Reset demo</button>
      </div>
      <main className="mx-auto grid w-full max-w-[1700px] flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:h-[calc(100dvh-28px)] xl:grid-cols-[250px_280px_minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="h-[520px] xl:h-full"><VoicePane session={chat.session} onUpdate={update} /></div>
        <div className="h-[520px] xl:h-full"><SmsPane onTapLink={tapLink} session={chat.session} onReplyDone={update} /></div>
        <div className="h-[520px] xl:h-full"><ChatPane state={chat} setState={setChat} /></div>
        <div className="h-[520px] xl:h-full"><DeskPane /></div>
      </main>
    </div>
  );
}
