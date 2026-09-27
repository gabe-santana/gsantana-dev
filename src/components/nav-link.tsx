"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const trimSlash = (value: string) => (value.length > 1 ? value.replace(/\/+$/, "") : value);

/**
 * A nav item that stays in its hover state while you're in its section
 * (a story counts as "News"), so the current item doesn't look like
 * something left to click.
 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = trimSlash(usePathname() ?? "");
  const target = trimSlash(href);
  const exact = pathname === target;
  const inSection = exact || pathname.startsWith(`${target}/`);

  return (
    <Link
      href={href}
      aria-current={exact ? "page" : undefined}
      className={`inline-flex items-center gap-2 transition-colors hover:text-foreground ${
        inSection ? "text-foreground" : ""
      }`}
    >
      {children}
    </Link>
  );
}
