export function buildTidalReleaseSearchUrl(artistName: string, releaseTitle: string) {
  const query = `${artistName} ${releaseTitle}`;
  return `https://listen.tidal.com/search?q=${encodeURIComponent(query)}`;
}
