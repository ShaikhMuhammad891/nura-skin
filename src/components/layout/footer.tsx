import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { footerNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

import { Container } from "./container";

/** Storefront footer (docs/13 §6.4). Newsletter and social links arrive in M3. */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-alt">
      <Container className="grid gap-12 py-16 lg:grid-cols-[1.2fr_2fr]">
        <div className="flex flex-col gap-4">
          <Logo withTagline />
          <p className="max-w-xs text-body-sm text-muted-foreground">{siteConfig.tagline}</p>
          <ThemeToggle className="self-start" />
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {footerNav.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h2 className="text-overline font-semibold text-muted-foreground uppercase">
                {group.title}
              </h2>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    {/* min-h-7 = 28px target: WCAG 2.5.8 target size (≥ 24px) with spacing. */}
                    <Link
                      href={item.href}
                      className="inline-flex min-h-7 items-center text-body-sm text-foreground hover:text-link"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>
      <Container className="flex flex-col gap-2 border-t border-border py-6 text-caption text-muted-foreground sm:flex-row sm:justify-between">
        <p>© Nura Skin. A fictional brand built as a portfolio project.</p>
        <p>Cosmetic guidance, not medical advice.</p>
      </Container>
    </footer>
  );
}
