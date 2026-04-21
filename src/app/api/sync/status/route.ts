import { getCurrentUser } from "@/lib/auth";
import { getUserSyncQueueStatus } from "@/lib/sync-queue-status";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getUserSyncQueueStatus(user.id);

  return Response.json(status);
}
