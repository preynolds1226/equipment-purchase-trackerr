"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  createSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: "H" },
  { label: "Requests", href: "/requests", icon: "R" },
  { label: "New Request", href: "/requests/new", icon: "+" },
  { label: "Equipment", href: "/equipment", icon: "EQ" },
  { label: "Purchase History", href: "/history", icon: "PO" },
  { label: "Employees", href: "/employees", icon: "E" },
  { label: "Vendors", href: "/vendors", icon: "V" },
  { label: "Settings", href: "/settings", icon: "S" },
];

const dailyNavItems = navItems.slice(0, 5);
const directoryNavItems = navItems.slice(5);

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const supabase = useMemo(() => {
    if (!hasSupabaseConfig()) {
      return null;
    }

    return createSupabaseBrowserClient();
  }, []);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => {
        setCheckingSession(false);
      });
      return;
    }

    let mounted = true;

    queueMicrotask(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      setUser(session?.user ?? null);
      setCheckingSession(false);

      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (!session?.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router, supabase]);

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
        <div className="rounded-lg border border-border bg-surface p-5 text-center shadow-sm">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="text-sm font-semibold">Checking sign in...</p>
        </div>
      </div>
    );
  }

  if (supabase && !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border bg-surface px-4 py-5 lg:block">
        <Link className="mb-7 block rounded-md outline-none focus:ring-2 focus:ring-accent/30" href="/">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Repair Shop
          </div>
          <div className="mt-1 text-xl font-bold leading-tight">Purchase Tracker</div>
        </Link>
        <nav className="grid gap-5" aria-label="Main navigation">
          <NavGroup items={dailyNavItems} pathname={pathname} title="Daily Work" />
          <NavGroup items={directoryNavItems} pathname={pathname} title="Directory" />
        </nav>
        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-border bg-background p-3">
          <p className="truncate text-xs font-semibold text-muted">
            {user?.email ?? "Supabase not configured"}
          </p>
          {user ? (
            <button
              className="mt-2 h-9 w-full rounded-md border border-border text-sm font-semibold"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              Repair Shop
            </div>
            <div className="truncate text-base font-bold">Purchase Tracker</div>
          </Link>
          <Link
            href="/requests/new"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-lg font-bold text-accent-foreground"
            aria-label="Create new request"
          >
            +
          </Link>
        </div>
        <details className="mt-3">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background text-sm font-semibold text-muted">
            Menu
          </summary>
          <nav className="mt-2 grid gap-1 rounded-lg border border-border bg-background p-2" aria-label="Compact mobile navigation">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <span className="grid h-6 w-6 place-items-center rounded bg-surface text-xs font-bold">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {user ? (
            <button
              className="mt-2 h-10 w-full rounded-md border border-border bg-background text-sm font-semibold"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          ) : null}
        </details>
      </header>

      <main className="pb-24 lg:ml-64 lg:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 gap-1">
          {dailyNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-[11px] font-semibold transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                <span className="mt-1 max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function NavGroup({
  items,
  pathname,
  title,
}: {
  items: NavItem[];
  pathname: string;
  title: string;
}) {
  return (
    <div>
      <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {title}
      </div>
      <div className="grid gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <span className="grid h-7 w-8 shrink-0 place-items-center rounded bg-background/70 text-xs font-bold">
                {item.icon}
              </span>
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
