import { getCurrentUser } from "@/lib/auth";
import { getArtistSyncQueue } from "@/lib/queue";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = getArtistSyncQueue();
  const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");

  return Response.json({ counts });
}
