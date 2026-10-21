"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Rail/mobile link that marks itself current. "/dashboard" only matches exactly; others match their subtree. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname() ?? "";
  const current = href === "/dashboard" ? path === href : path === href || path.startsWith(href + "/");
  return <Link href={href} aria-current={current ? "page" : undefined}>{children}</Link>;
}
