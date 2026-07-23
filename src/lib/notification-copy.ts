import { formatReleaseDate, getReleaseDateKey, getTodayDateKey } from "@/lib/timezone";
import { getEffectiveTimeZone } from "@/lib/timezone-server";

const NOTIFICATION_KIND_RELEASE_DAY = "release_day";

type NotificationCopyInput = {
  kind: string;
  release: {
    title: string;
    releaseDate: Date;
    artists: { artist: { canonicalName: string } }[];
  };
  user: {
    timezone: string;
  };
};

function buildDiscoveryBody(event: NotificationCopyInput, now: Date) {
  const timeZone = getEffectiveTimeZone(event.user.timezone);
  const releaseDateKey = getReleaseDateKey(event.release.releaseDate);
  const todayDateKey = getTodayDateKey(timeZone, now);
  const releaseDate = formatReleaseDate(event.release.releaseDate);

  if (releaseDateKey < todayDateKey) {
    return `Found late · ${releaseDate}`;
  }

  if (releaseDateKey === todayDateKey) {
    return "Release out today";
  }

  return `Upcoming · ${releaseDate}`;
}

export function buildNotificationCopy(event: NotificationCopyInput, now = new Date()) {
  const primaryArtist = event.release.artists[0]?.artist.canonicalName ?? "Unknown artist";
  const releaseTitle = event.release.title;

  return {
    title: `${primaryArtist} - ${releaseTitle}`,
    body:
      event.kind === NOTIFICATION_KIND_RELEASE_DAY
        ? "Out today"
        : buildDiscoveryBody(event, now),
  };
}
