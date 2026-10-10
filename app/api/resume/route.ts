import { handleResume } from "@/lib/orchestrator";
import { repo } from "@/lib/repo";
import { createSession } from "@/lib/sessions";
import { redeemLinkToken } from "@/lib/tokens";

/** Opening /chat?t=<token>: validate, burn the token, start an authenticated chat session with history. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const check = redeemLinkToken(repo, token);
  if (!check.ok) return Response.json({ ok: false, reason: check.reason });

  const session = createSession("chat", check.customerId);
  const customer = repo.getCustomer(check.customerId)!;
  const history = repo.getTimeline(customer.id)
    .filter((e) => e.role !== "tool" && e.channel !== "system" && !e.content.includes("/chat?t="))
    .map((e) => ({ channel: e.channel, role: e.role, text: e.content }));
  try {
    const { reply } = await handleResume(session);
    return Response.json({ ok: true, sessionToken: session.id, customerName: customer.fullName, history, reply });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "The agent is unavailable right now." }, { status: 502 });
  }
}
