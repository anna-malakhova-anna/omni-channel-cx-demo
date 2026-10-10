import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./prompt";
import { repo } from "./repo";
import type { Session } from "./sessions";
import { runTool, toolDefinitions } from "./tools";
import type { Channel } from "./types";

const MAX_STEPS = 8;
let client: Anthropic | undefined;
const model = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

/** Record a turn: straight to the customer's timeline if known, otherwise held until verification. */
function log(session: Session, channel: Channel, role: "customer" | "agent" | "tool", content: string) {
  if (session.customerId) repo.appendTimeline({ customerId: session.customerId, channel, role, content });
  else session.pendingTimeline.push({ channel, role, content });
}
function flushPending(session: Session) {
  if (!session.customerId) return;
  for (const p of session.pendingTimeline.splice(0)) repo.appendTimeline({ customerId: session.customerId, ...p });
}

/**
 * Channel-agnostic: channel only changes the system prompt's style rules.
 * Same tools, same loop, same timeline for voice, SMS and chat.
 */
export async function handleMessage(session: Session, message: string): Promise<{ reply: string }> {
  log(session, session.channel, "customer", message);
  return runTurn(session, message, message);
}

/** Customer just arrived on a new channel via a secure link: the agent speaks first, picking up where they left off. */
export async function handleResume(session: Session): Promise<{ reply: string }> {
  log(session, "system", "tool", `Customer opened secure link; resumed on ${session.channel}`);
  const notice = `[System notice, not from the customer: they just opened the secure link you texted them and are now in ${session.channel}. They are already verified. Greet them in one short sentence that acknowledges you are picking up from the earlier conversation, referencing the specific issue from the prior conversation, and invite them to add details. Do not re-verify.]`;
  return runTurn(session, notice, "");
}

async function runTurn(session: Session, userText: string, lastCustomerMessage: string): Promise<{ reply: string }> {
  client ??= new Anthropic();
  const channel = session.channel;
  session.messages.push({ role: "user", content: userText });

  let reply = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: model(), max_tokens: 1024,
      system: buildSystemPrompt(repo, session),
      tools: toolDefinitions, messages: session.messages,
    });
    session.messages.push({ role: "assistant", content: res.content });
    reply = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();

    const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!calls.length) break;

    const results: Anthropic.ToolResultBlockParam[] = calls.map((call) => {
      let out: Record<string, unknown>;
      try { out = runTool(call.name, call.input as Record<string, unknown>, { repo, session, lastCustomerMessage }); }
      catch (e) { out = { ok: false, error: "tool_failed", message: String(e) }; }
      flushPending(session);
      log(session, channel, "tool", `${call.name} → ${out.ok === false ? "error" : "ok"}`);
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out), is_error: out.ok === false };
    });
    session.messages.push({ role: "user", content: results });
  }

  reply ||= "Sorry, I hit a problem on my side. Could you say that again?";
  log(session, channel, "agent", reply);
  return { reply };
}
