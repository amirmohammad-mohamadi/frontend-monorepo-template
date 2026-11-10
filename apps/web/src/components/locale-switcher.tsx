"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components";
import { LOCALE_LABELS, LOCALES } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Switches the locale segment of the current URL; the cookie follows through next-intl. */
export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("language")}>
          <LanguagesIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            disabled={code === locale}
            onSelect={() =>
              router.replace(
                // @ts-expect-error next-intl types the pathname per route; this switcher is route-agnostic.
                { pathname, params },
                { locale: code }
              )
            }
          >
            {LOCALE_LABELS[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
