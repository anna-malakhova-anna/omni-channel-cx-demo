"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Minimal typings: the Web Speech API isn't in lib.dom for Chromium's prefixed implementation.
interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecCtor = new () => SpeechRec;

type Phase = "idle" | "speaking" | "listening" | "thinking";
interface Line { role: "customer" | "agent"; text: string }

const GREETING = "Thanks for calling Northgate Bank. To get started, may I have your full name and the last four digits of your card?";

/** Models sometimes slip in markdown or links; never let TTS read them out. */
const speakable = (t: string) => t.replace(/https?:\/\/\S+/g, "").replace(/[*_`#>|]/g, "").replace(/^\s*[-•]\s+/gm, "").replace(/\s+/g, " ").trim();

export default function VoicePane({ session, onUpdate }: { session?: string; onUpdate: (r: { sessionToken: string; customerName: string | null }) => void }) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => { const w = window as unknown as Record<string, unknown>; return !!(w.SpeechRecognition || w.webkitSpeechRecognition) && "speechSynthesis" in window; },
    () => true,
  );
  const [inCall, setInCall] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [note, setNote] = useState("");
  const rec = useRef<SpeechRec | null>(null);
  const heard = useRef("");
  const sessionRef = useRef(session);
  const callRef = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [lines, interim, phase]);
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); rec.current?.abort(); };
  }, []);

  function speak(text: string) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const clean = speakable(text);
    if (!clean) return setPhase("idle");
    const u = new SpeechSynthesisUtterance(clean);
    const voices = synth.getVoices();
    u.voice = voices.find((v) => v.lang === "en-CA") ?? voices.find((v) => v.lang.startsWith("en-US")) ?? null;
    u.rate = 1.05;
    u.onend = u.onerror = () => callRef.current && setPhase("idle");
    setPhase("speaking");
    synth.speak(u);
  }

  function startCall() {
    callRef.current = true;
    setInCall(true); setNote(""); setLines([{ role: "agent", text: GREETING }]);
    speak(GREETING);
  }
  function endCall() {
    callRef.current = false;
    window.speechSynthesis.cancel(); rec.current?.abort();
    setInCall(false); setPhase("idle"); setInterim("");
    setLines((l) => [...l, { role: "agent", text: "Call ended." }]);
  }

  function startListening() {
    if (!callRef.current || phase === "thinking" || rec.current) return;
    window.speechSynthesis.cancel(); // barge-in: talking over the agent stops it
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const R = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    const r = new R();
    r.lang = "en-CA"; r.interimResults = true; r.continuous = true;
    heard.current = ""; setInterim(""); setNote("");
    r.onresult = (e) => {
      const parts = Array.from(e.results).map((x) => x[0].transcript);
      heard.current = parts.join(" ").trim();
      setInterim(heard.current);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setNote("Microphone access is blocked. Allow it in the browser's site settings.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setNote(`Speech recognition error: ${e.error}`);
    };
    r.onend = () => {
      rec.current = null;
      const text = heard.current; heard.current = ""; setInterim("");
      if (!callRef.current) return;
      if (text) send(text);
      else { setPhase("idle"); setNote((n) => n || "Didn't catch that. Hold the button and try again."); }
    };
    rec.current = r;
    setPhase("listening");
    r.start();
  }
  const stopListening = () => rec.current?.stop();

  async function send(text: string) {
    setLines((l) => [...l, { role: "customer", text }]);
    setPhase("thinking");
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "voice", sessionToken: sessionRef.current, message: text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate(data);
      setLines((l) => [...l, { role: "agent", text: data.reply }]);
      if (callRef.current) speak(data.reply);
    } catch (e) {
      const msg = "Sorry, I'm having trouble right now. Please try again.";
      setLines((l) => [...l, { role: "agent", text: msg }]);
      setNote((e as Error).message);
      if (callRef.current) speak(msg);
    }
  }

  const status = { idle: "Hold to talk", speaking: "Agent speaking…", listening: "Listening…", thinking: "Thinking…" }[phase];

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <header className="border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h2 className="font-semibold">Voice</h2>
        <p className="text-xs text-zinc-500">Northgate Bank phone line · push to talk</p>
      </header>
      {!supported && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Voice needs speech recognition, which this browser doesn&apos;t support. Please open the demo in Chrome.</p>}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3 text-sm">
        {!inCall && lines.length === 0 && <p className="pt-6 text-center text-xs text-zinc-400">Press Call to phone the bank as Maya.</p>}
        {lines.map((l, i) => (
          <p key={i}><span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">{l.role === "agent" ? "Agent" : "You"}</span>{l.text}</p>
        ))}
        {interim && <p className="italic text-zinc-500"><span className="mr-1 text-[10px] font-medium uppercase not-italic tracking-wide">You</span>{interim}…</p>}
        <div ref={end} />
      </div>
      {note && <p className="pb-2 text-xs text-red-600">{note}</p>}
      <div className="flex flex-col items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        {!inCall ? (
          <button onClick={startCall} disabled={!supported} className="w-full rounded-full bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-40">📞 Call Northgate</button>
        ) : (
          <>
            <button
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startListening(); }}
              onPointerUp={stopListening} onPointerCancel={stopListening}
              onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startListening(); } }}
              onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stopListening(); }}
              disabled={phase === "thinking"}
              className={`w-full select-none rounded-full py-3 text-sm font-medium text-white transition ${phase === "listening" ? "scale-[1.02] bg-red-600" : "bg-blue-600"} disabled:opacity-50`}
            >🎙️ {status}</button>
            <button onClick={endCall} className="text-xs text-zinc-500 underline">End call</button>
          </>
        )}
      </div>
    </section>
  );
}
