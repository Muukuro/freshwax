import { searchArtists } from "@/lib/providers/deezer";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const results = await searchArtists(query);
  const followedMappings = await prisma.userFollow.findMany({
    where: { userId: user.id },
    select: {
      artist: {
        select: {
          mappings: {
            where: { provider: "DEEZER" },
            select: { providerArtistId: true },
          },
        },
      },
    },
  });

  const followed = new Set(
    followedMappings.flatMap((entry) => entry.artist.mappings.map((mapping) => mapping.providerArtistId)),
  );

  return Response.json(
    results.map((result) => ({
      ...result,
      alreadyFollowing: followed.has(result.providerArtistId),
    })),
  );
}
