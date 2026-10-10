"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChatPane, { type ChatState } from "@/components/ChatPane";
import { GREETING, applyResume, redeem } from "@/components/shared";

/** The real deep link target: /chat?t=<token>. Valid token -> authenticated chat with history; otherwise unauthenticated. */
function ChatFromLink() {
  const token = useSearchParams().get("t");
  const [chat, setChat] = useState<ChatState>({ who: null, msgs: [GREETING] });
  const ran = useRef(false); // tokens are single-use: never redeem twice (React strict mode)
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    redeem(token).then((d) => setChat(applyResume(d)));
  }, [token]);
  return <main className="mx-auto h-dvh max-w-xl p-4"><ChatPane state={chat} setState={(f) => setChat(f)} /></main>;
}

export default function ChatPage() {
  return <Suspense><ChatFromLink /></Suspense>;
}
