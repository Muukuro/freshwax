import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function AuthedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  return <AppShell userName={user.name}>{children}</AppShell>;
}
