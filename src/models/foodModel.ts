// ═══════════════════════════════════════════════════════
// MetroMatrix — Food model (pure rules for the customer Food home)
// ═══════════════════════════════════════════════════════

import type { Kitchen, KitchenKind } from '../types/food';

export const KITCHEN_KIND_LABEL: Record<KitchenKind, string> = {
  restaurant: 'Restaurant',
  home_kitchen: 'Home kitchen',
  cloud_kitchen: 'Cloud kitchen',
};

const norm = (s: string) => s.trim().toLowerCase();

/** Search matches the name, a cuisine or the area; the cuisine chip narrows further. */
export const filterKitchens = (kitchens: Kitchen[], { query, cuisine }: { query: string; cuisine: string | null }): Kitchen[] => {
  const q = norm(query);
  const c = cuisine ? norm(cuisine) : null;
  return kitchens.filter(k => {
    if (c && !k.cuisines.some(name => norm(name) === c)) return false;
    if (!q) return true;
    return norm(k.name).includes(q) || norm(k.area).includes(q) || k.cuisines.some(name => norm(name).includes(q));
  });
};

/** "25–35 min" */
export const formatEta = (k: Pick<Kitchen, 'etaMin' | 'etaMax'>): string =>
  k.etaMax > k.etaMin ? `${k.etaMin}–${k.etaMax} min` : `${k.etaMin} min`;

/** "Free delivery" or "Rs 49 delivery" */
export const formatDeliveryFee = (fee: number): string => (fee <= 0 ? 'Free delivery' : `Rs ${Math.round(fee)} delivery`);

/** "Rs", "Rs Rs", "Rs Rs Rs" — the price band, as Pakistani apps show it. */
export const priceLevelLabel = (level: number): string => Array.from({ length: Math.min(3, Math.max(1, level)) }, () => 'Rs').join(' ');

/** 2310 → "2.3k", 412 → "412" */
export const formatRatingCount = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));
