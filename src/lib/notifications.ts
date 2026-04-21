import { createHmac } from "node:crypto";

import {
  NotificationDeliveryChannel,
  NotificationDeliveryStatus,
  type Prisma,
  type ReleaseType,
} from "@prisma/client";
import webpush from "web-push";

import { buildReleaseTypeFilter, isReleaseVisibleForSettings } from "@/lib/data";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getEffectiveTimeZone } from "@/lib/timezone-server";
import { getTodayUtcDateForTimeZone } from "@/lib/timezone";
import { absoluteUrl } from "@/lib/utils";

const RELEASE_DAY_HOUR = 9;
const WEBHOOK_TARGET_KEY = "instance-webhook";
const MAX_NOTIFICATIONS_PER_DRAIN = 50;
const NOTIFICATION_KIND_RELEASE_DAY = "release_day";
const NOTIFICATION_KIND_RELEASE_DISCOVERED = "release_discovered";
const NOTIFICATION_STATUS_PENDING = "pending";
const NOTIFICATION_STATUS_DELIVERED = "delivered";
const NOTIFICATION_STATUS_SKIPPED = "skipped";

type NotificationKindValue =
  | typeof NOTIFICATION_KIND_RELEASE_DAY
  | typeof NOTIFICATION_KIND_RELEASE_DISCOVERED;

type TimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type NotificationContext = Prisma.NotificationEventGetPayload<{
  include: {
    deliveries: true;
    release: {
      include: {
        artists: {
          include: {
            artist: true;
          };
        };
        ignoredBy: true;
      };
    };
    user: {
      include: {
        settings: true;
        pushSubscriptions: true;
      };
    };
  };
}>;

let webPushConfigured = false;

function ensureWebPushClient() {
  if (webPushConfigured || !isWebPushConfigured()) {
    return;
  }

  webpush.setVapidDetails(env.APP_URL, env.WEB_PUSH_PUBLIC_KEY!, env.WEB_PUSH_PRIVATE_KEY!);
  webPushConfigured = true;
}

function getEventKindValue(kind: string): NotificationKindValue {
  return kind === NOTIFICATION_KIND_RELEASE_DAY
    ? NOTIFICATION_KIND_RELEASE_DAY
    : NOTIFICATION_KIND_RELEASE_DISCOVERED;
}

function getReleaseDateParts(releaseDate: Date) {
  return {
    year: releaseDate.getUTCFullYear(),
    month: releaseDate.getUTCMonth() + 1,
    day: releaseDate.getUTCDate(),
  };
}

function getTimeParts(date: Date, timeZone: string): TimeParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour === 24 ? 0 : values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localTimePartsToUtc(parts: TimeParts, timeZone: string) {
  const desiredUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let guess = desiredUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getTimeParts(new Date(guess), timeZone);
    const actualUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const diff = desiredUtc - actualUtc;

    if (diff === 0) {
      return new Date(guess);
    }

    guess += diff;
  }

  return new Date(guess);
}

function getNotificationPath(kind: string) {
  return kind === NOTIFICATION_KIND_RELEASE_DAY ? "/upcoming" : "/discoveries";
}

function buildNotificationCopy(event: NotificationContext) {
  const primaryArtist = event.release.artists[0]?.artist.canonicalName ?? "Unknown artist";

  if (event.kind === NOTIFICATION_KIND_RELEASE_DAY) {
    return {
      title: `${primaryArtist} release day`,
      body: `${event.release.title} is out today.`,
    };
  }

  return {
    title: `Freshwax found a release for ${primaryArtist}`,
    body: `${event.release.title} was added to your discoveries feed.`,
  };
}

function buildWebhookSignature(payload: string) {
  if (!env.NOTIFICATION_WEBHOOK_SECRET) {
    return null;
  }

  return createHmac("sha256", env.NOTIFICATION_WEBHOOK_SECRET).update(payload).digest("hex");
}

function isEventEnabledForUser(event: NotificationContext) {
  const settings = event.user.settings;
  if (!settings) {
    return false;
  }

  return event.kind === NOTIFICATION_KIND_RELEASE_DAY
    ? settings.notifyOnReleaseDay
    : settings.notifyOnDiscovery;
}

function isReleaseVisibleForUser(event: NotificationContext) {
  const settings = event.user.settings;
  if (!settings) {
    return false;
  }

  if (
    settings.hideIgnored &&
    event.release.ignoredBy.some((ignoredRelease) => ignoredRelease.userId === event.userId)
  ) {
    return false;
  }

  const typeFilter = buildReleaseTypeFilter(settings);
  if (
    typeFilter &&
    "notIn" in typeFilter &&
    typeFilter.notIn?.includes(event.release.type as ReleaseType)
  ) {
    return false;
  }

  return isReleaseVisibleForSettings(
    {
      title: event.release.title,
      rawSource: event.release.rawSource,
      artists: event.release.artists,
    },
    settings,
  );
}

function buildWebhookPayload(event: NotificationContext) {
  const primaryArtist = event.release.artists[0]?.artist;

  return {
    notificationEventId: event.id,
    kind: getEventKindValue(event.kind),
    user: {
      id: event.user.id,
      email: event.user.email,
      timezone: event.user.timezone,
    },
    release: {
      id: event.release.id,
      title: event.release.title,
      type: event.release.type,
      releaseDate: event.release.releaseDate.toISOString(),
    },
    artist: primaryArtist
      ? {
          id: primaryArtist.id,
          name: primaryArtist.canonicalName,
        }
      : null,
    targetUrl: absoluteUrl(getNotificationPath(event.kind)),
    createdAt: event.createdAt.toISOString(),
    scheduledFor: event.scheduledFor.toISOString(),
  };
}

function getSkipReason(event: NotificationContext) {
  if (!isEventEnabledForUser(event)) {
    return "Notification type disabled for user";
  }

  if (!isReleaseVisibleForUser(event)) {
    return "Release is filtered out by current user settings";
  }

  return null;
}

async function sendWebhookNotification(event: NotificationContext) {
  if (!env.NOTIFICATION_WEBHOOK_URL) {
    return { delivered: false, permanentFailure: true, message: "Webhook not configured" };
  }

  const payload = JSON.stringify(buildWebhookPayload(event));
  const signature = buildWebhookSignature(payload);
  const response = await fetch(env.NOTIFICATION_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-freshwax-signature": signature } : {}),
    },
    body: payload,
  });

  if (response.ok) {
    return {
      delivered: true,
      permanentFailure: false,
      message: null,
    };
  }

  return {
    delivered: false,
    permanentFailure: false,
    message: `Webhook returned ${response.status}`,
  };
}

async function sendWebPushNotification(event: NotificationContext, endpoint: string) {
  const subscription = event.user.pushSubscriptions.find((entry) => entry.endpoint === endpoint);
  if (!subscription) {
    return {
      delivered: false,
      permanentFailure: true,
      message: "Push subscription no longer exists",
    };
  }

  if (!isWebPushConfigured()) {
    return {
      delivered: false,
      permanentFailure: true,
      message: "Web push keys not configured",
    };
  }

  ensureWebPushClient();

  const copy = buildNotificationCopy(event);

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: copy.title,
        body: copy.body,
        tag: `${getEventKindValue(event.kind)}:${event.releaseId}`,
        data: {
          notificationEventId: event.id,
          kind: getEventKindValue(event.kind),
          url: absoluteUrl(getNotificationPath(event.kind)),
        },
      }),
      {
        TTL: 60 * 60,
        urgency: event.kind === NOTIFICATION_KIND_RELEASE_DAY ? "high" : "normal",
      },
    );

    return {
      delivered: true,
      permanentFailure: false,
      message: null,
    };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : null;

    if (statusCode === 404 || statusCode === 410) {
      await prisma.pushSubscription.deleteMany({
        where: {
          userId: event.userId,
          endpoint: subscription.endpoint,
        },
      });

      return {
        delivered: false,
        permanentFailure: true,
        message: `Push subscription expired (${statusCode})`,
      };
    }

    return {
      delivered: false,
      permanentFailure: false,
      message: error instanceof Error ? error.message : "Unknown web push failure",
    };
  }
}

async function updateDeliveryAttempt(
  eventId: string,
  deliveryId: string,
  result: { delivered: boolean; permanentFailure: boolean; message: string | null },
) {
  const now = new Date();

  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status:
        result.delivered
          ? NotificationDeliveryStatus.DELIVERED
          : result.permanentFailure
            ? NotificationDeliveryStatus.FAILED
            : NotificationDeliveryStatus.PENDING,
      lastAttemptedAt: now,
      deliveredAt: result.delivered ? now : null,
      lastError: result.message,
    },
  });

  await prisma.notificationEvent.update({
    where: { id: eventId },
    data: {
      lastAttemptedAt: now,
      lastError: result.message,
    },
  });
}

async function refreshNotificationEventStatus(eventId: string) {
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { eventId },
  });

  if (deliveries.length === 0) {
    await prisma.notificationEvent.update({
      where: { id: eventId },
      data: {
        status: NOTIFICATION_STATUS_SKIPPED,
      },
    });
    return;
  }

  const hasPending = deliveries.some(
    (delivery) => delivery.status === NotificationDeliveryStatus.PENDING,
  );
  if (hasPending) {
    await prisma.notificationEvent.update({
      where: { id: eventId },
      data: {
        status: NOTIFICATION_STATUS_PENDING,
      },
    });
    return;
  }

  const successfulDelivery = deliveries
    .filter((delivery) => delivery.deliveredAt)
    .sort((left, right) => (right.deliveredAt?.getTime() ?? 0) - (left.deliveredAt?.getTime() ?? 0))[0];

  await prisma.notificationEvent.update({
    where: { id: eventId },
    data: {
      status: successfulDelivery
        ? NOTIFICATION_STATUS_DELIVERED
        : NOTIFICATION_STATUS_SKIPPED,
      deliveredAt: successfulDelivery?.deliveredAt ?? null,
    },
  });
}

async function materializeDeliveries(event: NotificationContext) {
  const deliveries: Prisma.NotificationDeliveryCreateManyInput[] = [];

  if (isWebPushConfigured()) {
    for (const subscription of event.user.pushSubscriptions) {
      deliveries.push({
        eventId: event.id,
        channel: NotificationDeliveryChannel.WEB_PUSH,
        targetKey: subscription.endpoint,
      });
    }
  }

  if (env.NOTIFICATION_WEBHOOK_URL) {
    deliveries.push({
      eventId: event.id,
      channel: NotificationDeliveryChannel.WEBHOOK,
      targetKey: WEBHOOK_TARGET_KEY,
    });
  }

  if (deliveries.length === 0) {
    await prisma.notificationEvent.update({
      where: { id: event.id },
      data: {
        status: NOTIFICATION_STATUS_SKIPPED,
        lastAttemptedAt: new Date(),
        lastError: "No notification delivery channels are configured",
      },
    });
    return [];
  }

  await prisma.notificationDelivery.createMany({
    data: deliveries,
    skipDuplicates: true,
  });

  return prisma.notificationDelivery.findMany({
    where: {
      eventId: event.id,
      status: NotificationDeliveryStatus.PENDING,
    },
  });
}

export function isWebPushConfigured() {
  return Boolean(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY);
}

export function scheduleNotificationEvent(
  kind: NotificationKindValue,
  releaseDate: Date,
  timeZone: string,
  now = new Date(),
) {
  if (kind === NOTIFICATION_KIND_RELEASE_DISCOVERED) {
    return now;
  }

  const releaseDateParts = getReleaseDateParts(releaseDate);
  const effectiveTimeZone = getEffectiveTimeZone(timeZone);

  return localTimePartsToUtc(
    {
      ...releaseDateParts,
      hour: RELEASE_DAY_HOUR,
      minute: 0,
      second: 0,
    },
    effectiveTimeZone,
  );
}

export async function createReleaseDiscoveredNotifications(
  users: { userId: string }[],
  releaseId: string,
  artistId: string,
  payload?: Prisma.InputJsonValue,
) {
  if (users.length === 0) {
    return;
  }

  const now = new Date();

  await prisma.notificationEvent.createMany({
    data: users.map((user) => ({
      userId: user.userId,
      releaseId,
      kind: NOTIFICATION_KIND_RELEASE_DISCOVERED,
      scheduledFor: now,
      payload:
        payload ??
        ({
          artistId,
        } satisfies Prisma.InputJsonValue),
    })),
    skipDuplicates: true,
  });
}

export async function createReleaseDayNotifications(
  users: { userId: string; timezone: string }[],
  releaseId: string,
  releaseDate: Date,
  artistId: string,
) {
  if (users.length === 0) {
    return;
  }

  await prisma.notificationEvent.createMany({
    data: users.map((user) => ({
      userId: user.userId,
      releaseId,
      kind: NOTIFICATION_KIND_RELEASE_DAY,
      scheduledFor: scheduleNotificationEvent(
        NOTIFICATION_KIND_RELEASE_DAY,
        releaseDate,
        user.timezone,
      ),
      payload: {
        artistId,
      } satisfies Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
}

export async function backfillReleaseDayNotificationsForFollow(
  userId: string,
  artistId: string,
  timeZone: string,
) {
  const today = getTodayUtcDateForTimeZone(getEffectiveTimeZone(timeZone));
  const releases = await prisma.release.findMany({
    where: {
      releaseDate: {
        gte: today,
      },
      artists: {
        some: {
          artistId,
        },
      },
    },
    select: {
      id: true,
      releaseDate: true,
    },
  });

  await prisma.notificationEvent.createMany({
    data: releases.map((release) => ({
      userId,
      releaseId: release.id,
      kind: NOTIFICATION_KIND_RELEASE_DAY,
      scheduledFor: scheduleNotificationEvent(
        NOTIFICATION_KIND_RELEASE_DAY,
        release.releaseDate,
        timeZone,
      ),
      payload: {
        artistId,
      } satisfies Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
}

export async function drainNotificationQueue() {
  const events = await prisma.notificationEvent.findMany({
    where: {
      status: NOTIFICATION_STATUS_PENDING,
      scheduledFor: {
        lte: new Date(),
      },
    },
    include: {
      deliveries: true,
      release: {
        include: {
          artists: {
            include: {
              artist: true,
            },
          },
          ignoredBy: true,
        },
      },
      user: {
        include: {
          settings: true,
          pushSubscriptions: true,
        },
      },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
    take: MAX_NOTIFICATIONS_PER_DRAIN,
  });

  for (const event of events) {
    const skipReason = getSkipReason(event);
    if (skipReason) {
      await prisma.notificationEvent.update({
        where: { id: event.id },
        data: {
          status: NOTIFICATION_STATUS_SKIPPED,
          lastAttemptedAt: new Date(),
          lastError: skipReason,
        },
      });
      continue;
    }

    const pendingDeliveries =
      event.deliveries.filter((delivery) => delivery.status === NotificationDeliveryStatus.PENDING)
        .length > 0
        ? event.deliveries.filter(
            (delivery) => delivery.status === NotificationDeliveryStatus.PENDING,
          )
        : await materializeDeliveries(event);

    for (const delivery of pendingDeliveries) {
      const result =
        delivery.channel === NotificationDeliveryChannel.WEBHOOK
          ? await sendWebhookNotification(event)
          : await sendWebPushNotification(event, delivery.targetKey);

      await updateDeliveryAttempt(event.id, delivery.id, result);
    }

    await refreshNotificationEventStatus(event.id);
  }
}
