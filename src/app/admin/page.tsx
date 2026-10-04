import { Container, Section } from "@/components/layout/container";
import { getActor } from "@/lib/server/actor";

/** Admin home placeholder (docs/15 A1). The dashboard, KPIs and work queues arrive with M8. */
export default async function AdminHomePage() {
  const actor = await getActor();
  return (
    <Section>
      <Container className="flex flex-col gap-4">
        <h1 className="font-display text-display-lg font-light">Admin</h1>
        <p className="max-w-prose text-body-lg text-muted-foreground">
          You&apos;re signed in as <strong className="text-foreground">{actor.role}</strong> with{" "}
          {actor.permissions.size} permissions. The dashboard arrives in a later milestone.
        </p>
      </Container>
    </Section>
  );
}
