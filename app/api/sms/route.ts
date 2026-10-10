import { repo } from "@/lib/repo";

/**
 * Stand-in for the carrier: returns the secure-link texts sent to a customer's phone.
 * Demo-only and unauthenticated; the SMS pane is hard-wired to Maya's handset.
 */
export async function GET(req: Request) {
  const customerId = new URL(req.url).searchParams.get("customerId") ?? "";
  const messages = repo.getTimeline(customerId).filter((e) => e.channel === "sms" && e.role === "agent" && e.content.includes("/chat?t="));
  return Response.json({ messages: messages.map((m) => ({ id: m.id, text: m.content, timestamp: m.timestamp })) });
}
