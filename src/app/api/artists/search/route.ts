import { searchCatalogArtists } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildFollowedMusicBrainzArtistIdSet,
  isMusicBrainzArtistFollowed,
} from "@/lib/artist-follow-status";

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
          musicbrainzArtistId: true,
        },
      },
    },
  });

  const followed = buildFollowedMusicBrainzArtistIdSet(
    followedArtists.map((entry) => entry.artist),
  );

  return Response.json(
    results.map((result) => ({
      ...result,
      alreadyFollowing: isMusicBrainzArtistFollowed(followed, result.musicbrainzArtistId),
    })),
  );
}
