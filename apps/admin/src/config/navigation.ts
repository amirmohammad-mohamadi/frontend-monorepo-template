import { LayoutDashboardIcon, ListIcon, SettingsIcon, type LucideIcon } from "lucide-react";
import { TEXTS } from "@/texts";

export type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  /** Nested entries render as a collapsible group. */
  items?: { title: string; url: string }[];
};

/** The sidebar. Access per entry comes from `ROUTE_PERMISSIONS` in lib/permissions.ts, keyed by `url`. */
export const NAV_MAIN: NavItem[] = [
  { title: TEXTS.nav.overview, url: "/", icon: LayoutDashboardIcon },
  { title: TEXTS.nav.examples, url: "/examples", icon: ListIcon },
];

export const NAV_SECONDARY: NavItem[] = [{ title: TEXTS.nav.settings, url: "/settings", icon: SettingsIcon }];
