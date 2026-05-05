"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Disc3, LayoutDashboard, Menu, Search, Settings, X } from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { SubmitButton } from "@/components/submit-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recent", label: "Recent", icon: Disc3 },
  { href: "/upcoming", label: "Upcoming", icon: CalendarClock },
  { href: "/artists", label: "Artists", icon: Search },
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
      <div className="mx-auto w-full max-w-[1680px] px-0 py-0 md:px-7 md:py-4">
        <div className="shell-grid min-h-[calc(100vh-2rem)] items-start md:gap-4">
          <aside className="sidebar-panel sticky top-4 hidden h-[calc(100vh-2rem)] flex-col justify-between px-6 py-4 md:flex">
            <div>
              <div>
                <p className="eyebrow">Private release tracker</p>
                <p className="brand-wordmark font-display mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  Freshwax
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  A calm desk for fresh releases, future dates, and the artists you follow.
                </p>
              </div>

              <nav className="mt-6 flex flex-col gap-2">
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

            <div className="sidebar-user mt-6 pt-4">
              <p className="eyebrow">Signed in</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{userName}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Your watchlist, filters, and calendar feed stay private to this instance.
              </p>
              <div className="mt-4">
                <PwaInstallPrompt />
              </div>
              <form action={signOut} className="mt-4">
                <SubmitButton className="ghost-button w-full" pendingLabel="Leaving...">
                  Sign out
                </SubmitButton>
              </form>
            </div>
          </aside>

          <main className="flex min-w-0 flex-col gap-4 p-4 md:p-0">
            <div className="mobile-header md:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <div>
                  <p className="eyebrow">Private release tracker</p>
                  <p className="brand-wordmark font-display text-xl font-semibold tracking-[-0.03em]">
                    Freshwax
                  </p>
                </div>
              </div>
              <button
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                className="mobile-menu-toggle"
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
                  <div className="mt-4">
                    <PwaInstallPrompt />
                  </div>
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
