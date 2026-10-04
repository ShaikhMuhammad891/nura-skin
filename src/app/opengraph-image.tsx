import { ImageResponse } from "next/og";

/** Default social card (docs/15 OG images). Per-product cards arrive with the packshot assets. */
export const alt = "Nura Skin: your routine, explained.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#FAF7F2",
        color: "#1F1A17",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", fontSize: 64, letterSpacing: 2 }}>
        nura
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#B8785A",
            marginLeft: 6,
            marginTop: 10,
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 88, lineHeight: 1.02, letterSpacing: -2 }}>
          Your skin, understood.
        </div>
        <div style={{ fontSize: 32, color: "#5E554E" }}>
          Routines built for your skin in three minutes, with every step explained.
        </div>
      </div>
    </div>,
    size,
  );
}
