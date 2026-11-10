"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components";
import { TEXTS } from "@/texts";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={TEXTS.common.theme}>
          <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme("light")}>{TEXTS.common.themeLight}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("dark")}>{TEXTS.common.themeDark}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme("system")}>{TEXTS.common.themeSystem}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
