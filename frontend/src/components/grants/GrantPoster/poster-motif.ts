import type { Grant } from "@/types/grants";

const categoryMotifs = {
  교육: "book",
  사업화: "growth",
  공간: "storefront",
  융자: "coins",
  멘토링: "dialogue",
} as const;

const abstractMotifs = ["orbit", "layers", "ripple"] as const;
type CategoryMotif = (typeof categoryMotifs)[keyof typeof categoryMotifs];
export type GrantPosterMotif = CategoryMotif | (typeof abstractMotifs)[number];
const palettes = Object.values(categoryMotifs);

export function posterTheme({ cat, id }: Pick<Grant, "cat" | "id">): { motif: GrantPosterMotif; palette: CategoryMotif } {
  const category = cat.trim();
  if (Object.hasOwn(categoryMotifs, category)) {
    const motif = categoryMotifs[category as keyof typeof categoryMotifs];
    return { motif, palette: motif };
  }

  // The API supplies no artwork. The same grant must keep its cover in every view.
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return {
    motif: abstractMotifs[hash % abstractMotifs.length],
    palette: palettes[Math.floor(hash / abstractMotifs.length) % palettes.length],
  };
}
