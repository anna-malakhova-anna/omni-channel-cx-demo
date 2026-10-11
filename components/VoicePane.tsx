"use client";
import { Bubble, CardHeader } from "./shared";
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

const GREETING = "Thanks for calling Proud North Bank. To get started, may I have your full name and the last four digits of your card?";

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
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [lines, interim, phase]);
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
    <section aria-label="Voice call" className="flex h-full min-h-0 flex-col rounded-card border border-card-border bg-card p-4 text-onlight shadow-card">
      <CardHeader channel="voice" title="Voice" live={phase === "speaking" || phase === "thinking"} right={phase === "speaking" ? <span className="wave flex h-4 items-center gap-0.5" aria-hidden="true"><i /><i /><i /></span> : undefined} />
      {!supported && <p className="mt-3 rounded-bubble bg-[#F3E3D6] p-3 text-[13px] text-[#5A3418]">Voice needs speech recognition, which this browser doesn&apos;t support. Please open the demo in Chrome.</p>}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
        {!inCall && lines.length === 0 && <p className="pt-8 text-center text-[15px] text-onlight-muted">Call Proud North as Maya Chen to start.</p>}
        {lines.map((l, i) => <Bubble key={i} role={l.role}>{l.text}</Bubble>)}
        <div ref={end} />
      </div>
      {note && <p role="alert" className="pb-2 text-[13px] text-[#9A2B1F]">{note}</p>}
      <div className="flex flex-col items-center gap-2 border-t border-card-border pt-3">
        {interim && <p className="line-clamp-2 min-h-5 text-center text-[15px] italic text-onlight-muted">{interim}…</p>}
        {!inCall ? (
          <button onClick={startCall} disabled={!supported} className="btn-primary w-full">Call Proud North</button>
        ) : (
          <>
            <button
              aria-pressed={phase === "listening"} aria-label="Push to talk: hold while you speak"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startListening(); }}
              onPointerUp={stopListening} onPointerCancel={stopListening}
              onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startListening(); } }}
              onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stopListening(); }}
              disabled={phase === "thinking"}
              className={`flex h-20 w-20 select-none items-center justify-center rounded-full border-2 border-ch-voice transition-colors duration-200 disabled:opacity-50 ${phase === "listening" ? "ripple bg-ch-voice" : "bg-transparent"}`}
            >
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill={phase === "listening" ? "#fff" : "var(--ch-voice-ink)"} aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1A7 7 0 0 0 19 12z" /></svg>
            </button>
            <span className="text-[13px] text-onlight-muted">{status}</span>
            <button onClick={endCall} className="btn-secondary-light !h-9 text-[13px]">End call</button>
          </>
        )}
      </div>
    </section>
  );
}
