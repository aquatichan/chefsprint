// Billing scaffolding for Chefsprint Pro. Prices and plan copy live here;
// checkout is stubbed until Stripe is configured.
//
// TO WIRE UP STRIPE:
//   1. Create the products/prices in the Stripe dashboard.
//   2. Create a Payment Link (or Checkout Session endpoint) per plan.
//   3. Paste each plan's link/ID into `stripePaymentLink` below (or set the
//      NEXT_PUBLIC_STRIPE_LINK_* env vars, which take precedence).
//   4. Point the Stripe webhook at the engine to set users/{uid}.plan = "pro"
//      (the field is Admin-SDK-only per firestore.rules).

/** Free AI generations per account. Mirrors FREE_AI_GENERATIONS in engine/app/firebase.py. */
export const FREE_AI_GENERATIONS = 2;

export interface Plan {
  id: "pro-monthly" | "pro-yearly";
  name: string;
  price: string;
  cadence: string;
  badge?: string;
  /** Stripe Payment Link or Price ID — empty until configured. */
  stripePaymentLink: string;
}

export const PLANS: Plan[] = [
  {
    id: "pro-monthly",
    name: "Pro",
    price: "$5.99",
    cadence: "/ month",
    stripePaymentLink: process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY ?? "",
  },
  {
    id: "pro-yearly",
    name: "Pro yearly",
    price: "$59.99",
    cadence: "/ year",
    badge: "1 month free",
    stripePaymentLink: process.env.NEXT_PUBLIC_STRIPE_LINK_YEARLY ?? "",
  },
];

export const PRO_FEATURES = [
  "Unlimited AI cookbook generations",
  "Complete allergen, serving size, & diet personalization",
  "Unlimited photo generation for every recipe & variant",
  "Unlimited remixes of any cookbook",
  "Premium cookbook styling and layout options",
  "Priority support",
];

/**
 * Send the user to Stripe checkout for `plan`. Returns false when the plan
 * isn't wired to Stripe yet (callers show a "coming soon" notice).
 */
export function startCheckout(plan: Plan): boolean {
  if (!plan.stripePaymentLink) return false;
  window.location.assign(plan.stripePaymentLink);
  return true;
}
