"use client";

import { UserButton } from "@clerk/nextjs";
import { ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";

import { adminBreadcrumbs, type AdminNavGroup } from "../nav";
import { AdminNavLinks } from "./admin-nav-links";

/** Admin topbar (docs/16 AdminTopbar): mobile nav sheet, breadcrumbs, theme, user menu. */
export function AdminTopbar({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname();
  const crumbs = adminBreadcrumbs(pathname);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex h-15 items-center gap-3 px-4 sm:px-6">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label="Open admin navigation"
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-alt lg:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-lg outline-none">
              <div className="flex h-15 items-center justify-between border-b border-border px-4">
                <Dialog.Title className="sr-only">Admin navigation</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Sections you have access to.
                </Dialog.Description>
                <Logo />
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close navigation"
                    className="inline-flex size-11 items-center justify-center rounded-md hover:bg-surface-alt"
                  >
                    <X aria-hidden className="size-5" />
                  </button>
                </Dialog.Close>
              </div>
              <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-5">
                <AdminNavLinks groups={groups} onNavigate={() => setOpen(false)} />
              </nav>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Link
          href="/admin"
          aria-label="Nura Skin admin home"
          className="hidden rounded-sm sm:block"
        >
          <Logo />
        </Link>
        <Badge variant="accent">Admin</Badge>

        <nav aria-label="Breadcrumb" className="ml-2 hidden min-w-0 md:block">
          <ol className="flex items-center gap-1 text-body-sm text-muted-foreground">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={crumb.href} className="flex min-w-0 items-center gap-1">
                  {i > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0" /> : null}
                  {last ? (
                    <span aria-current="page" className="truncate text-foreground">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link href={crumb.href} className="truncate hover:text-foreground">
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <span className="inline-flex size-11 items-center justify-center">
            <UserButton />
          </span>
        </div>
      </div>
    </header>
  );
}
