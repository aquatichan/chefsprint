// Billing for Chefsprint AI credit packs, sold via Cash App.
//
// There's no Cash App API/webhook to confirm a payment automatically, so this
// is a manual flow: the user pays via a Cash App link (with a note carrying
// their account email so it can be matched up), then an admin grants the
// credits from /admin (see app/admin/page.tsx) via POST /admin/grant-credits.

/** Free AI generations every account starts with. Mirrors FREE_AI_GENERATIONS in engine/app/firebase.py. */
export const FREE_AI_GENERATIONS = 2;

export const CASHTAG = "$aaronqin";

export interface CreditPack {
  id: "small" | "medium" | "large";
  name: string;
  credits: number;
  price: number; // USD
  badge?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "small", name: "Small", credits: 10, price: 5 },
  { id: "medium", name: "Medium", credits: 30, price: 12, badge: "Most popular" },
  { id: "large", name: "Large", credits: 60, price: 20, badge: "Best value" },
];

/** Cash App payment link pre-filled with the pack's amount. */
export function cashAppLink(pack: CreditPack): string {
  return `https://cash.app/${CASHTAG.replace(/^\$/, "")}/${pack.price}`;
}

export const PRO_FEATURES = [
  "AI request understanding - plain-English variants & servings",
  "Allergen & diet personalization",
  "AI dish photos for every recipe",
  "Each credit = one AI-assisted cookbook generation",
];
