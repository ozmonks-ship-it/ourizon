export interface AssetAccount {
  name: string;
  institution: string;
  balance: number;
  spark: number[];
}

export interface AssetGroup {
  id: string;
  label: string;
  accounts: AssetAccount[];
}

export const HISTORICAL = [
  { label: "Jan '24", value: 235000 },
  { label: "Mar '24", value: 244800 },
  { label: "May '24", value: 258700 },
  { label: "Jul '24", value: 262100 },
  { label: "Sep '24", value: 271200 },
  { label: "Nov '24", value: 285100 },
  { label: "Jan '25", value: 296800 },
  { label: "Mar '25", value: 307600 },
  { label: "May '25", value: 312450 },
];

export const ASSET_GROUPS: AssetGroup[] = [
  {
    id: "cash",
    label: "Cash 💵",
    accounts: [
      {
        name: "Everyday Account",
        institution: "CommBank",
        balance: 12450,
        spark: [11200, 11800, 12100, 11900, 12300, 12450],
      },
      {
        name: "High-Interest Savings",
        institution: "ING",
        balance: 32750,
        spark: [28000, 29500, 30200, 31100, 32000, 32750],
      },
    ],
  },
  {
    id: "stocks",
    label: "Stocks & ETFs 📈",
    accounts: [
      {
        name: "Global ETF Portfolio",
        institution: "Vanguard",
        balance: 98350,
        spark: [85000, 89200, 92100, 88500, 95400, 98350],
      },
      {
        name: "AU Shares",
        institution: "CommSec",
        balance: 30000,
        spark: [24000, 26500, 27800, 28200, 29500, 30000],
      },
    ],
  },
  {
    id: "crypto",
    label: "Crypto ₿",
    accounts: [
      {
        name: "Bitcoin",
        institution: "CoinSpot",
        balance: 22100,
        spark: [18500, 21200, 19800, 20100, 21800, 22100],
      },
    ],
  },
  {
    id: "property",
    label: "Property 🏠",
    accounts: [],
  },
  {
    id: "super",
    label: "Super 🏦",
    accounts: [
      {
        name: "Alex's Super",
        institution: "Australian Retirement Trust",
        balance: 71250,
        spark: [62000, 64200, 66100, 67800, 69500, 71250],
      },
      {
        name: "Sam's Super",
        institution: "Hostplus",
        balance: 45550,
        spark: [38000, 39800, 41200, 42500, 44100, 45550],
      },
    ],
  },
];
