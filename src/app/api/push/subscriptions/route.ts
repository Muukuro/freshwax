import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const deleteSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = pushSubscriptionSchema.parse(await request.json());
  const subscription = await prisma.pushSubscription.upsert({
    where: {
      endpoint: body.endpoint,
    },
    update: {
      userId: user.id,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    create: {
      userId: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
  });

  return Response.json(subscription, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = deleteSubscriptionSchema.parse(await request.json());

  await prisma.pushSubscription.deleteMany({
    where: {
      userId: user.id,
      endpoint: body.endpoint,
    },
  });

  return new Response(null, { status: 204 });
}
