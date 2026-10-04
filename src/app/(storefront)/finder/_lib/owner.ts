import "server-only";

import { readAnonymousId } from "@/features/finder/server/consult-cookie";
import type { ConsultationOwner } from "@/features/finder/server/service";
import { getActor } from "@/lib/server/actor";

/** The current visitor as a consultation owner (signed-in user, else the guest cookie). */
export async function currentConsultationOwner(): Promise<ConsultationOwner> {
  const actor = await getActor();
  if (actor.userId) return { userId: actor.userId, anonymousId: null };
  return { userId: null, anonymousId: await readAnonymousId() };
}
