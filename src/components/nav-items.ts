import {
  CreditCard,
  LayoutDashboard,
  PiggyBank,
  ReceiptText,
  Tags,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", icon: ReceiptText },
  { href: "/contas", label: "Contas", icon: CreditCard },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/investimentos", label: "Invest.", icon: PiggyBank },
  { href: "/projecao", label: "Projeção", icon: TrendingUp },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
