"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components";

export function ThemeToggle() {
  const t = useTranslations("common");
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme")}>
          <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme("light")}>{t("themeLight")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>{t("themeDark")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>{t("themeSystem")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
