import { ReleaseType } from "@prisma/client";

export function classifyReleaseType(
  recordType: string | null | undefined,
  title: string,
) {
  const lowerTitle = title.toLowerCase();
  const lowerRecordType = (recordType ?? "").toLowerCase();

  if (lowerTitle.includes("remaster")) return ReleaseType.REMASTER;
  if (lowerTitle.includes("reissue") || lowerTitle.includes("anniversary"))
    return ReleaseType.REISSUE;
  if (lowerTitle.includes("live")) return ReleaseType.LIVE;
  if (lowerTitle.includes("compilation") || lowerTitle.includes("greatest hits"))
    return ReleaseType.COMPILATION;
  if (lowerRecordType === "single") return ReleaseType.SINGLE;
  if (lowerRecordType === "ep") return ReleaseType.EP;
  if (lowerRecordType === "album") return ReleaseType.ALBUM;

  return ReleaseType.UNKNOWN;
}
