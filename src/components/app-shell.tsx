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
          <aside className="panel sticky top-6 self-start hidden min-h-[calc(100vh-3rem)] flex-col justify-between p-6 md:flex">
            <div>
              <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">Freshwax</p>

              <nav className="mt-8 space-y-2">
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

            <div className="panel-muted mt-6 p-4">
              <p className="eyebrow">Signed in</p>
              <p className="mt-2 text-base font-semibold text-[var(--text)]">{userName}</p>
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
                <p className="font-display text-xl font-semibold tracking-[-0.03em] text-[var(--text)]">Freshwax</p>
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
