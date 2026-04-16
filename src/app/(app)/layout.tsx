import { AppShell } from "@/components/app-shell";
import { requireOnboardedUser } from "@/lib/auth";
import { ensureAppSyncForUser } from "@/lib/sync-policy";

export default async function AuthedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireOnboardedUser();
  await ensureAppSyncForUser(user.id);

  return <AppShell userName={user.name}>{children}</AppShell>;
}
