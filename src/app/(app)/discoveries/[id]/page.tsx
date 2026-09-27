import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscoveryReveal } from "@/components/game/DiscoveryReveal";
import { isAppError } from "@/lib/api/errors";
import { requirePageUser } from "@/lib/auth/context";
import { getDiscovery } from "@/lib/discovery/service";

export const metadata: Metadata = { title: "Discovery" };

export default async function DiscoveryPage(props: PageProps<"/discoveries/[id]">) {
  const { user } = await requirePageUser({ requireConfirmed: true });
  const { id } = await props.params;
  const sp = await props.searchParams;
  let discovery;
  try {
    discovery = await getDiscovery(user.id, id);
  } catch (err) {
    if (isAppError(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  const reused = sp.reused === "1";
  return (
    <DiscoveryReveal
      discovery={{ ...discovery, reused: discovery.reused || reused, locationLocked: sp.locked === "1" }}
      animate={sp.reveal === "1"}
    />
  );
}
