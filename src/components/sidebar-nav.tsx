"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";

import { NAV_ITEMS, isActive } from "@/components/nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r p-3 md:flex">
      <Link href="/" className="mb-4 flex items-center gap-2 px-2 py-1">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <Wallet className="size-4" />
        </span>
        <span className="font-heading text-base font-semibold">Finanças</span>
      </Link>

      <ul className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {children}
    </aside>
  );
}
