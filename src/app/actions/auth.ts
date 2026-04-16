"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import {
  createSession,
  destroySession,
  ensureUserScaffold,
  getPostAuthRedirect,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

const authSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function signUp(formData: FormData) {
  const parsed = authSchema.extend({ name: z.string().min(2) }).safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid");
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    redirect("/signup?error=exists");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
    },
  });

  await ensureUserScaffold(user.id);
  await createSession(user.id);
  redirect(await getPostAuthRedirect(user.id));
}

export async function signIn(formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user) {
    redirect("/login?error=credentials");
  }

  if (!user.passwordHash) {
    redirect("/login?error=external-only");
  }

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!isValid) {
    redirect("/login?error=credentials");
  }

  await ensureUserScaffold(user.id);
  await createSession(user.id);
  redirect(await getPostAuthRedirect(user.id));
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
