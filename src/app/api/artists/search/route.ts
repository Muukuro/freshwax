import { searchCatalogArtists } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeName } from "@/lib/utils";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const results = await searchCatalogArtists(query);
  const followedArtists = await prisma.userFollow.findMany({
    where: { userId: user.id },
    select: {
      artist: {
        select: {
          canonicalName: true,
        },
      },
    },
  });

  const followed = new Set(
    followedArtists.map((entry) => normalizeName(entry.artist.canonicalName)),
  );

  return Response.json(
    results.map((result) => ({
      ...result,
      alreadyFollowing: followed.has(normalizeName(result.name)),
    })),
  );
}
