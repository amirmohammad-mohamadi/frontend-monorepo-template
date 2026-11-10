import { Separator, SidebarTrigger } from "@components";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ title }: { title?: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ms-1" />
      <Separator orientation="vertical" className="me-2 h-4" />
      {title ? <h1 className="text-sm font-medium">{title}</h1> : null}
      <div className="ms-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
