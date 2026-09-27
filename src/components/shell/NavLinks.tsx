"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

const LINKS = [
  { href: "/play", label: "Home", icon: Icon.Home },
  { href: "/collection", label: "Collection", icon: Icon.Cards },
  { href: "/scan", label: "Scan", icon: Icon.Scan, primary: true },
  { href: "/profile", label: "Profile", icon: Icon.User },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/collection") return pathname.startsWith("/collection") || pathname.startsWith("/cards");
  if (href === "/scan") return pathname.startsWith("/scan") || pathname.startsWith("/discoveries");
  if (href === "/profile") return pathname.startsWith("/profile") || pathname.startsWith("/security");
  return pathname === href;
}

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {LINKS.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-bold transition ${
              "primary" in l
                ? "bg-gradient-to-b from-sun-300 to-sun-500 text-sun-900 shadow-button"
                : active
                  ? "bg-white/10 text-ink"
                  : "text-muted hover:bg-white/5 hover:text-ink"
            }`}
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-bold ${active ? "text-mint-300" : "text-faint"}`}
              >
                {"primary" in l ? (
                  <span className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-sun-300 to-sun-500 text-sun-900 shadow-button ring-4 ring-night-950">
                    <l.icon className="h-6 w-6" />
                  </span>
                ) : (
                  <l.icon className="h-6 w-6" />
                )}
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
