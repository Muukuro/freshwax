"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Disc3, LayoutDashboard, Menu, Search, Settings, X } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--mobile-header-bg)] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-[10px] md:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(135deg,_rgba(45,109,246,1),_rgba(16,42,71,1))] text-white shadow-[0_10px_24px_rgba(24,52,84,0.22)]">
                  <Disc3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.95rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                    Freshwax
                  </p>
                </div>
              </div>
              <button
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--mobile-toggle-bg)] text-[var(--text)] shadow-[0_6px_16px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:-translate-y-px hover:bg-[var(--mobile-toggle-bg-hover)]"
                onClick={() => setMobileMenuOpen((open) => !open)}
                type="button"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

            {mobileMenuOpen ? (
              <nav className="panel p-3 md:hidden">
                <div className="grid grid-cols-2 gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        className={`nav-link nav-link--mobile ${isActive ? "nav-link--active" : ""}`}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="panel-muted mt-3 p-4">
                  <p className="eyebrow">Signed in</p>
                  <p className="mt-2 text-base font-semibold text-[var(--text)]">{userName}</p>
                  <form action={signOut} className="mt-4">
                    <SubmitButton className="ghost-button w-full" pendingLabel="Leaving...">
                      Sign out
                    </SubmitButton>
                  </form>
                </div>
              </nav>
            ) : null}

            <div className="pb-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
