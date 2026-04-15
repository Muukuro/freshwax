"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Disc3, LayoutDashboard, Radio, Search, Settings } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/artists", label: "Artists", icon: Search },
  { href: "/upcoming", label: "Upcoming", icon: CalendarClock },
  { href: "/discoveries", label: "Discoveries", icon: Disc3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-8 md:py-6">
        <div className="shell-grid min-h-[calc(100vh-2rem)]">
          <aside className="panel hidden flex-col justify-between p-6 md:flex">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Freshwax</p>
                  <h1 className="font-display mt-3 text-4xl leading-none tracking-[-0.04em] text-[var(--text)]">
                    Release tracking for people who actually listen on purpose.
                  </h1>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(135deg,_rgba(45,109,246,1),_rgba(16,42,71,1))] text-white shadow-[0_14px_30px_rgba(24,52,84,0.2)]">
                  <Disc3 className="h-5 w-5" />
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
                A structured release desk with private watchlists, discovery events, sync status, and
                a calendar feed that feels closer to studio tooling than startup wallpaper.
              </p>

              <nav className="mt-10 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      className={`nav-link ${isActive ? "nav-link--active" : ""}`}
                      href={item.href}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="panel-muted p-4">
              <p className="eyebrow">Signed in</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{userName}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Local account, local server, local queue worker.
              </p>
              <form action={signOut} className="mt-4">
                <SubmitButton className="ghost-button w-full" pendingLabel="Leaving...">
                  Sign out
                </SubmitButton>
              </form>
            </div>
          </aside>

          <main className="flex min-w-0 flex-col gap-4">
            <header className="topbar px-5 py-4 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="eyebrow">Listening desk</p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--text)]">
                    Track release dates, late discoveries, and queue health.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="status-pill">
                    <Disc3 className="h-4 w-4" />
                    Self-hosted music ops
                  </span>
                  <a
                    className="ghost-button"
                    href="https://www.deezer.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Radio className="h-4 w-4" />
                    Deezer catalog
                  </a>
                </div>
              </div>
            </header>

            <nav className="topbar flex gap-2 overflow-x-auto p-2 md:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    className={`nav-link shrink-0 ${isActive ? "nav-link--active" : ""}`}
                    href={item.href}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="pb-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
