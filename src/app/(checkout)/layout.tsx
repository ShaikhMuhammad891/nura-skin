import Link from "next/link";

import { Container } from "@/components/layout/container";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { Logo } from "@/components/shared/logo";

/** Focused checkout layout (docs/15): logo only, no navigation leaking attention from payment. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <header className="border-b border-border">
        <Container className="flex h-15 items-center lg:h-18">
          <Link href="/" aria-label="Nura Skin home" className="rounded-sm">
            <Logo />
          </Link>
        </Container>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 py-12 outline-none sm:py-20"
      >
        {children}
      </main>
    </>
  );
}
