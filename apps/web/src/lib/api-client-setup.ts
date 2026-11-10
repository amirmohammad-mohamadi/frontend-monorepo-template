import { configureApiClientTransport } from "@services";
import { env } from "@/env";

/**
 * How the web app reaches the backend. In the browser, paths the BFF proxy
 * owns go through `/api/backend` (the proxy adds the session token from the
 * httpOnly cookie); public paths go straight to the backend. On the server
 * everything goes straight to the backend with no token: server components
 * that need the session read it from cookies and call the backend themselves.
 *
 * Imported once by the root providers so it runs before any query.
 */
const proxied = new Set(env.WEB_PROXY_PREFIXES);

function isProxied(path: string): boolean {
  for (const prefix of proxied) if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) return true;
  return false;
}

configureApiClientTransport({
  resolveUrl: (path) =>
    typeof window !== "undefined" && isProxied(path)
      ? `/api/backend${path}`
      : `${(typeof window === "undefined" ? env.INTERNAL_API_BASE_URL : env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")}${path}`,
  getAuthToken: () => null,
  headers: (): Record<string, string> => {
    if (typeof document === "undefined") return {};
    const locale = document.documentElement.lang;
    return locale ? { "Accept-Language": locale } : {};
  },
});
