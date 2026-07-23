-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('DEEZER', 'TIDAL', 'SPOTIFY', 'APPLE_MUSIC', 'YOUTUBE_MUSIC', 'AMAZON_MUSIC');

-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('ALBUM', 'SINGLE', 'EP', 'COMPILATION', 'LIVE', 'REISSUE', 'REMASTER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('SYNC_ALL_ARTISTS', 'SYNC_FOLLOWED_ARTIST');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('WEB_PUSH', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProviderMappingSource" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingAccountMerge" (
    "token" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingAccountMerge_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "includeSingles" BOOLEAN NOT NULL DEFAULT true,
    "includeEps" BOOLEAN NOT NULL DEFAULT true,
    "includeCompilations" BOOLEAN NOT NULL DEFAULT false,
    "includeLive" BOOLEAN NOT NULL DEFAULT false,
    "includeReissues" BOOLEAN NOT NULL DEFAULT false,
    "hideClassicalComposerAppearances" BOOLEAN NOT NULL DEFAULT true,
    "hideIgnored" BOOLEAN NOT NULL DEFAULT true,
    "futureHorizonDays" INTEGER NOT NULL DEFAULT 180,
    "discoveryWindowDays" INTEGER NOT NULL DEFAULT 30,
    "notifyOnReleaseDay" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnDiscovery" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeezerConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deezerUserId" TEXT NOT NULL,
    "deezerUserName" TEXT,
    "accessToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeezerConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotifyConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spotifyUserId" TEXT NOT NULL,
    "spotifyUserName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TidalConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tidalUserId" TEXT NOT NULL,
    "tidalUserName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TidalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppleMusicConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appleMusicUserId" TEXT,
    "musicUserToken" TEXT NOT NULL,
    "storefront" TEXT,
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppleMusicConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LastfmConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastfmUserName" TEXT NOT NULL,
    "importMinPlaycount" INTEGER NOT NULL DEFAULT 10,
    "lastImportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastfmConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPlatformPreference" (
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "favoriteRank" INTEGER,
    "showArtistLinks" BOOLEAN NOT NULL DEFAULT true,
    "showReleaseLinks" BOOLEAN NOT NULL DEFAULT true,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlatformPreference_pkey" PRIMARY KEY ("userId","provider")
);

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "musicbrainzArtistId" TEXT NOT NULL,
    "wikidataEntityId" TEXT,
    "isClassicalComposer" BOOLEAN NOT NULL DEFAULT false,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "normalizedAliases" TEXT[],
    "imageUrl" TEXT,
    "deezerFans" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistProviderMapping" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerArtistId" TEXT NOT NULL,
    "url" TEXT,
    "rawJson" JSONB,
    "source" "ProviderMappingSource" NOT NULL DEFAULT 'AUTOMATIC',
    "manuallyCorrectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFollow" (
    "userId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("userId","artistId")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "type" "ReleaseType" NOT NULL DEFAULT 'UNKNOWN',
    "coverUrl" TEXT,
    "deezerUrl" TEXT,
    "tidalUrl" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rawSource" JSONB,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseProviderMapping" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerReleaseId" TEXT NOT NULL,
    "url" TEXT,
    "rawJson" JSONB,
    "source" "ProviderMappingSource" NOT NULL DEFAULT 'AUTOMATIC',
    "manuallyCorrectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseArtist" (
    "releaseId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'primary',

    CONSTRAINT "ReleaseArtist_pkey" PRIMARY KEY ("releaseId","artistId")
);

-- CreateTable
CREATE TABLE "DiscoveryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "artistId" TEXT,
    "reason" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IgnoredRelease" (
    "userId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredRelease_pkey" PRIMARY KEY ("userId","releaseId")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" "NotificationDeliveryChannel" NOT NULL,
    "targetKey" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "lastAttemptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "artistId" TEXT,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PendingAccountMerge_targetUserId_expiresAt_idx" ON "PendingAccountMerge"("targetUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "PendingAccountMerge_sourceUserId_idx" ON "PendingAccountMerge"("sourceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarToken_userId_key" ON "CalendarToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarToken_token_key" ON "CalendarToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DeezerConnection_userId_key" ON "DeezerConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeezerConnection_deezerUserId_key" ON "DeezerConnection"("deezerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyConnection_userId_key" ON "SpotifyConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyConnection_spotifyUserId_key" ON "SpotifyConnection"("spotifyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TidalConnection_userId_key" ON "TidalConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TidalConnection_tidalUserId_key" ON "TidalConnection"("tidalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AppleMusicConnection_userId_key" ON "AppleMusicConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LastfmConnection_userId_key" ON "LastfmConnection"("userId");

-- CreateIndex
CREATE INDEX "ExternalIdentity_userId_idx" ON "ExternalIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentity_provider_providerUserId_key" ON "ExternalIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "UserPlatformPreference_provider_idx" ON "UserPlatformPreference"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_musicbrainzArtistId_key" ON "Artist"("musicbrainzArtistId");

-- CreateIndex
CREATE INDEX "Artist_normalizedName_idx" ON "Artist"("normalizedName");

-- CreateIndex
CREATE INDEX "ArtistProviderMapping_artistId_idx" ON "ArtistProviderMapping"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistProviderMapping_provider_providerArtistId_key" ON "ArtistProviderMapping"("provider", "providerArtistId");

-- CreateIndex
CREATE INDEX "UserFollow_artistId_idx" ON "UserFollow"("artistId");

-- CreateIndex
CREATE INDEX "Release_releaseDate_idx" ON "Release"("releaseDate");

-- CreateIndex
CREATE INDEX "Release_firstDiscoveredAt_idx" ON "Release"("firstDiscoveredAt");

-- CreateIndex
CREATE INDEX "Release_type_idx" ON "Release"("type");

-- CreateIndex
CREATE INDEX "ReleaseProviderMapping_releaseId_idx" ON "ReleaseProviderMapping"("releaseId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseProviderMapping_provider_providerReleaseId_key" ON "ReleaseProviderMapping"("provider", "providerReleaseId");

-- CreateIndex
CREATE INDEX "ReleaseArtist_artistId_idx" ON "ReleaseArtist"("artistId");

-- CreateIndex
CREATE INDEX "DiscoveryEvent_userId_discoveredAt_idx" ON "DiscoveryEvent"("userId", "discoveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryEvent_userId_releaseId_key" ON "DiscoveryEvent"("userId", "releaseId");

-- CreateIndex
CREATE INDEX "NotificationEvent_userId_status_idx" ON "NotificationEvent"("userId", "status");

-- CreateIndex
CREATE INDEX "NotificationEvent_status_scheduledFor_idx" ON "NotificationEvent"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_userId_releaseId_kind_key" ON "NotificationEvent"("userId", "releaseId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_updatedAt_idx" ON "NotificationDelivery"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_eventId_channel_targetKey_key" ON "NotificationDelivery"("eventId", "channel", "targetKey");

-- CreateIndex
CREATE INDEX "SyncJob_status_createdAt_idx" ON "SyncJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarToken" ADD CONSTRAINT "CalendarToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeezerConnection" ADD CONSTRAINT "DeezerConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotifyConnection" ADD CONSTRAINT "SpotifyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TidalConnection" ADD CONSTRAINT "TidalConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppleMusicConnection" ADD CONSTRAINT "AppleMusicConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastfmConnection" ADD CONSTRAINT "LastfmConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlatformPreference" ADD CONSTRAINT "UserPlatformPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistProviderMapping" ADD CONSTRAINT "ArtistProviderMapping_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseProviderMapping" ADD CONSTRAINT "ReleaseProviderMapping_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseArtist" ADD CONSTRAINT "ReleaseArtist_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseArtist" ADD CONSTRAINT "ReleaseArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryEvent" ADD CONSTRAINT "DiscoveryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryEvent" ADD CONSTRAINT "DiscoveryEvent_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryEvent" ADD CONSTRAINT "DiscoveryEvent_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgnoredRelease" ADD CONSTRAINT "IgnoredRelease_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgnoredRelease" ADD CONSTRAINT "IgnoredRelease_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
