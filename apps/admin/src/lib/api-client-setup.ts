import { configureApiClientTransport } from "@services";
import { env } from "@/env";

/**
 * Admin transport: in the browser every path under the proxied prefixes goes
 * through `/api/backend`, which adds the operator's token from the httpOnly
 * cookie; anything else goes straight to the backend.
 */
const proxied = env.ADMIN_PROXY_PREFIXES;

function isProxied(path: string): boolean {
  return proxied.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

configureApiClientTransport({
  resolveUrl: (path) =>
    typeof window !== "undefined" && isProxied(path)
      ? `/api/backend${path}`
      : `${(typeof window === "undefined" ? env.INTERNAL_API_BASE_URL : env.NEXT_PUBLIC_API_BASE_URL).replace(/\/$/, "")}${path}`,
  getAuthToken: () => null,
});
