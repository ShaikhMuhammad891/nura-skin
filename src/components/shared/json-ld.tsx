/**
 * Structured data (docs/15, Next JSON-LD guide). `<` is escaped so content can never close the
 * script tag (XSS via product copy).
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- the Next JSON-LD pattern; `<` is escaped below
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
