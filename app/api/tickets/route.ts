import { repo } from "@/lib/repo";

/** Helpdesk view: each ticket joined with its customer, dispute and the cross-channel timeline. */
export async function GET() {
  const tickets = repo.getTickets().map((t) => {
    const customer = t.customerId ? repo.getCustomer(t.customerId) : undefined;
    const dispute = t.disputeId ? repo.getDisputes(t.customerId!).find((d) => d.id === t.disputeId) : undefined;
    const txn = dispute && repo.getTransaction(dispute.transactionId);
    const timeline = t.customerId
      ? repo.getTimeline(t.customerId).map((e) => ({
          id: e.id, channel: e.channel, role: e.role, timestamp: e.timestamp,
          // Never show a live token to a human agent.
          content: e.content.replace(/https?:\/\/\S+\/chat\?t=\S+/g, "[secure link]"),
        }))
      : [];
    return {
      id: t.id, status: t.status, createdAt: t.createdAt, summary: t.summary,
      customer: customer ? { id: customer.id, fullName: customer.fullName, phone: customer.phone, email: customer.email } : null,
      dispute: dispute ? { id: dispute.id, status: dispute.status, note: dispute.customerNote, merchant: txn?.merchant, amount: txn?.amount, currency: txn?.currency } : null,
      timeline,
    };
  });
  return Response.json({ tickets: tickets.reverse() });
}
