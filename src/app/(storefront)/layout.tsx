import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { SearchPalette } from "@/features/catalog/components/search-palette";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <Header search={<SearchPalette />} />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer />
    </>
  );
}
