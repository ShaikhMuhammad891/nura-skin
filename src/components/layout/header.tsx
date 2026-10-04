import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/shared/logo";
import { mainNav } from "@/config/navigation";

import { Container } from "./container";
import { MobileNav } from "./mobile-nav";

/**
 * Storefront header (docs/13 §6.4): logo, main nav, ⌘K search, account, and the mobile sheet.
 * The mega-menu and cart drawer arrive with the M4 UI; the finder CTA with M6.
 */
export function Header({ search }: { search?: React.ReactNode }) {
  return (
    <header className="backdrop-blur-header sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <Container className="flex h-15 items-center justify-between gap-6 lg:h-18">
        <div className="flex items-center gap-1">
          <MobileNav items={mainNav} />
          <Link href="/" aria-label="Nura Skin home" className="rounded-sm">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) => (
              <li key={item.href} className="hidden md:block">
                <Link
                  href={item.href}
                  className="inline-flex h-11 items-center rounded-md px-3 text-body-sm font-medium text-foreground hover:bg-surface-alt"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="ml-1 flex items-center">{search}</li>
            <li className="flex items-center">
              {/* Session-dependent: streamed so the rest of the page stays prerendered. */}
              <Suspense fallback={<span aria-hidden className="inline-block h-11 w-20" />}>
                <AccountControls />
              </Suspense>
            </li>
          </ul>
        </nav>
      </Container>
    </header>
  );
}

const navLinkClass =
  "inline-flex h-11 items-center rounded-md px-3 text-body-sm font-medium text-foreground hover:bg-surface-alt";

/** Sign-in link for guests; account link + Clerk user menu once signed in (docs/10 §4.6). */
function AccountControls() {
  return (
    <>
      <Show when="signed-out">
        <Link href="/sign-in" className={navLinkClass}>
          Sign in
        </Link>
      </Show>
      <Show when="signed-in">
        <Link href="/account" className={`${navLinkClass} hidden sm:inline-flex`}>
          Account
        </Link>
        <span className="inline-flex size-11 items-center justify-center">
          <UserButton />
        </span>
      </Show>
    </>
  );
}
