/**
 * Clerk component styling from our design tokens (docs/10 §4.1, docs/13). CSS variables, so the
 * light/dark switch from next-themes applies to Clerk's UI without re-rendering.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--surface)",
    colorForeground: "var(--foreground)",
    colorMuted: "var(--surface-alt)",
    colorMutedForeground: "var(--muted-foreground)",
    colorInput: "var(--surface)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorRing: "var(--ring)",
    colorDanger: "var(--danger)",
    colorSuccess: "var(--success)",
    colorWarning: "var(--warning)",
    colorNeutral: "var(--foreground)",
    fontFamily: "var(--font-sans)",
    borderRadius: "var(--radius-sm)",
  },
} as const;
