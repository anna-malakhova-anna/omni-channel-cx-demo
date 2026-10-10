import { repo } from "@/lib/repo";
import { resetSessions } from "@/lib/sessions";

export async function POST() {
  repo.reset();
  resetSessions();
  return Response.json({ ok: true });
}
