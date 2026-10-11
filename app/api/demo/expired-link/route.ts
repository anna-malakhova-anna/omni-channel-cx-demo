import { repo } from "@/lib/repo";
import { mintLinkToken } from "@/lib/tokens";

/** Demo helper: texts a link that was minted 20 minutes ago, so the expired-token path can be shown on demand. */
export async function POST(req: Request) {
  const { customerId } = await req.json().catch(() => ({}));
  if (!repo.getCustomer(customerId)) return Response.json({ error: "unknown customer" }, { status: 400 });
  const token = mintLinkToken(repo, customerId, "add_dispute_details", Date.now() - 20 * 60 * 1000);
  const base = process.env.APP_URL || "http://localhost:3000";
  repo.appendTimeline({ customerId, channel: "sms", role: "agent", content: `Proud North Bank: tap to securely add details to your dispute (link expires in 15 min): ${base}/chat?t=${token}` });
  return Response.json({ ok: true });
}
