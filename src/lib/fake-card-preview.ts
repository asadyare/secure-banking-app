import { addDays, setHours, setMinutes, subDays } from "date-fns";

export type PreviewTxnCategory = "food" | "shopping" | "entertainment";

export type FakePreviewTransaction = {
  merchant: string;
  amount: number;
  category: PreviewTxnCategory;
  date: Date;
};

const FOOD = ["Starbucks", "Chipotle", "DoorDash", "McDonald's", "Whole Foods Market"] as const;
const SHOPPING = ["Amazon", "Target", "Apple Store", "Nike", "Best Buy"] as const;
const ENTERTAINMENT = ["Netflix", "Spotify", "AMC Theatres", "Disney+", "Steam"] as const;

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Four recent-looking demo charges with real brand names and varied dates/times (deterministic per account). */
export function fakePreviewTransactions(accountId: string): FakePreviewTransaction[] {
  const h = hash32(accountId);
  const pools: { cat: PreviewTxnCategory; names: readonly string[] }[] = [
    { cat: "food", names: FOOD },
    { cat: "shopping", names: SHOPPING },
    { cat: "entertainment", names: ENTERTAINMENT },
    { cat: "food", names: FOOD },
  ];
  const base = subDays(new Date(), 21);

  return pools.map((pool, i) => {
    const idx = (h + i * 7919) % pool.names.length;
    const name = pool.names[idx]!;
    const cents = 499 + ((h >> (i * 3)) % 19500);
    const amount = Math.round(cents) / 100;
    const dayOffset = 1 + ((h + i * 17) % 18);
    const hour = 9 + ((h + i) % 12);
    const minute = (h + i * 13) % 60;
    let d = addDays(base, dayOffset);
    d = setMinutes(setHours(d, hour), minute);
    return { merchant: name, amount, category: pool.cat, date: d };
  });
}
