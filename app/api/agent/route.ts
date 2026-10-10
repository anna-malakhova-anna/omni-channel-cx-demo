import { handleMessage } from "@/lib/orchestrator";
import { repo } from "@/lib/repo";
import { createSession, getSession } from "@/lib/sessions";
import type { Channel } from "@/lib/types";

const CHANNELS: Channel[] = ["voice", "sms", "chat"];

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const channel = CHANNELS.includes(body?.channel) ? (body.channel as Channel) : null;
  if (!message || !channel) return Response.json({ error: "channel and message are required" }, { status: 400 });
  if (message.length > 2000) return Response.json({ error: "message too long" }, { status: 400 });

  let session = typeof body.sessionToken === "string" ? getSession(body.sessionToken) : undefined;
  session ??= createSession(channel);
  session.channel = channel; // a session can move between channels; only the style rules change

  try {
    const { reply } = await handleMessage(session, message);
    const customer = session.customerId ? repo.getCustomer(session.customerId) : undefined;
    return Response.json({ sessionToken: session.id, reply, verified: !!customer, customerName: customer?.fullName ?? null });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "The agent is unavailable right now." }, { status: 502 });
  }
}
