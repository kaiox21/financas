/**
 * Ícones oferecidos para categorias.
 *
 * Lista curada de propósito: `lucide-react` tem ~1750 ícones e importar o
 * objeto inteiro colocaria todos no bundle do cliente. Aqui só entram os que
 * fazem sentido para finanças pessoais.
 *
 * As chaves são os nomes em kebab-case gravados em `categories.icon`.
 */

import {
  Baby,
  Banknote,
  Beer,
  Bike,
  Book,
  Briefcase,
  Bus,
  Car,
  CircleDashed,
  Clapperboard,
  Coffee,
  Coins,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Leaf,
  Lightbulb,
  PartyPopper,
  PiggyBank,
  Pill,
  Plane,
  Repeat,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  house: House,
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  coffee: Coffee,
  beer: Beer,
  car: Car,
  bus: Bus,
  bike: Bike,
  fuel: Fuel,
  plane: Plane,
  "heart-pulse": HeartPulse,
  stethoscope: Stethoscope,
  pill: Pill,
  dumbbell: Dumbbell,
  "party-popper": PartyPopper,
  clapperboard: Clapperboard,
  gamepad: Gamepad2,
  "graduation-cap": GraduationCap,
  book: Book,
  laptop: Laptop,
  smartphone: Smartphone,
  wifi: Wifi,
  lightbulb: Lightbulb,
  repeat: Repeat,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  landmark: Landmark,
  coins: Coins,
  "hand-coins": HandCoins,
  banknote: Banknote,
  wallet: Wallet,
  briefcase: Briefcase,
  gift: Gift,
  shirt: Shirt,
  scissors: Scissors,
  sparkles: Sparkles,
  baby: Baby,
  dog: Dog,
  leaf: Leaf,
  hammer: Hammer,
  wrench: Wrench,
  "circle-dashed": CircleDashed,
};

export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

export const DEFAULT_ICON = "circle-dashed";

export function iconFor(name: string | null | undefined): LucideIcon {
  return CATEGORY_ICONS[name ?? ""] ?? CATEGORY_ICONS[DEFAULT_ICON];
}

/** Paleta oferecida no seletor de cor. */
export const CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#6b7280",
];

export const DEFAULT_COLOR = "#6b7280";
