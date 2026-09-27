import type { Metadata } from "next";
import Link from "next/link";
import { GubbleCard } from "@/components/card/GubbleCard";
import { ElementGlyph, Icon, RarityGem } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/context";
import { CollectionFilterSchema, listCollection, type CollectionFilter } from "@/lib/cards/service";
import { ELEMENTS, ELEMENT_IDS, FAMILIES, FAMILY_IDS, RARITIES, RARITY_IDS } from "@/lib/game/catalogue";

export const metadata: Metadata = { title: "Collection" };

function hrefWith(current: CollectionFilter, key: keyof CollectionFilter, value: string | undefined) {
  const next = { ...current, [key]: current[key] === value ? undefined : value };
  const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
  const s = qs.toString();
  return s ? `/collection?${s}` : "/collection";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      scroll={false}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-sm font-bold transition ${
        active ? "border-mint-400 bg-mint-400 text-night-950" : "border-white/12 bg-night-900/70 text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function CollectionPage(props: PageProps<"/collection">) {
  const { user } = await requirePageUser();
  const sp = await props.searchParams;
  const parsed = CollectionFilterSchema.safeParse({
    family: typeof sp.family === "string" ? sp.family : undefined,
    element: typeof sp.element === "string" ? sp.element : undefined,
    rarity: typeof sp.rarity === "string" ? sp.rarity : undefined,
  });
  const filter: CollectionFilter = parsed.success ? parsed.data : {};
  const { cards, total } = await listCollection(user.id, filter);
  const filtered = Boolean(filter.family || filter.element || filter.rarity);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Little creatures. Big stories.</p>
          <h1 className="mt-2 font-display text-4xl font-bold">My collection</h1>
        </div>
        <p className="text-sm font-bold text-muted">
          {total} Gubble{total === 1 ? "" : "s"} collected
        </p>
      </header>

      {total > 0 ? (
        <nav aria-label="Filter collection" className="space-y-2">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Family">
            {FAMILY_IDS.map((f) => (
              <Chip key={f} href={hrefWith(filter, "family", f)} active={filter.family === f}>
                {FAMILIES[f].name}
              </Chip>
            ))}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Element and rarity">
            {ELEMENT_IDS.map((e) => (
              <Chip key={e} href={hrefWith(filter, "element", e)} active={filter.element === e}>
                <ElementGlyph element={e} className="h-4 w-4" />
                {ELEMENTS[e].name}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 bg-white/10" aria-hidden="true" />
            {RARITY_IDS.map((r) => (
              <Chip key={r} href={hrefWith(filter, "rarity", r)} active={filter.rarity === r}>
                <RarityGem rarity={r} className="h-3.5 w-3.5" />
                {RARITIES[r].name}
              </Chip>
            ))}
            {filtered ? (
              <Link href="/collection" scroll={false} className="inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1.5 text-sm font-bold text-coral-300 hover:underline">
                <Icon.X className="h-4 w-4" /> Clear
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}

      {cards.length ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cards.map((c, i) => (
            <li key={c.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <Link href={`/cards/${c.id}`} className="block rounded-[1.1rem] transition hover:-translate-y-1 hover:rotate-[-1deg]">
                <GubbleCard face={c} minted={c} size="thumb" />
              </Link>
            </li>
          ))}
        </ul>
      ) : total === 0 ? (
        <div className="panel flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-lagoon-400/15 text-lagoon-300 animate-float">
            <Icon.Cards className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-bold">No Gubbles yet</h2>
          <p className="max-w-md text-muted">Every QR code out there could be hiding one. Scan your first and it&apos;ll show up here.</p>
          <ButtonLink href="/scan" size="lg">
            <Icon.Scan className="h-5 w-5" /> Find my first Gubble
          </ButtonLink>
        </div>
      ) : (
        <div className="panel px-6 py-10 text-center">
          <p className="font-display text-xl font-bold">No Gubbles match those filters.</p>
          <Link href="/collection" className="mt-2 inline-block font-bold text-lagoon-300 hover:underline">Clear filters</Link>
        </div>
      )}
    </div>
  );
}
