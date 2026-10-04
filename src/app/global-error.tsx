"use client";

/**
 * Root error boundary (docs/15 ER4). Replaces the root layout, so it must render
 * <html>/<body> itself and cannot rely on providers, fonts or Tailwind loading.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#FAF7F2",
          color: "#1F1A17",
          fontFamily: "Georgia, serif",
        }}
      >
        <main style={{ maxWidth: 520, padding: 24 }}>
          <h1 style={{ fontWeight: 300, fontSize: 36, margin: "0 0 12px" }}>
            Something went wrong.
          </h1>
          <p style={{ fontFamily: "system-ui, sans-serif", color: "#5E554E", lineHeight: 1.6 }}>
            We&apos;ve been notified. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              height: 44,
              padding: "0 20px",
              borderRadius: 12,
              border: 0,
              background: "#1F1A17",
              color: "#FAF7F2",
              fontFamily: "system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
