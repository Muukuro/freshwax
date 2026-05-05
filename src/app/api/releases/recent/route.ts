import { getCurrentUser } from "@/lib/auth";
import { getRecentReleases } from "@/lib/data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const releases = await getRecentReleases(user.id);
  return Response.json(releases);
}
