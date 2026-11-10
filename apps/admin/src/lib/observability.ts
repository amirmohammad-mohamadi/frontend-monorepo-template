import { setErrorReporter, type ErrorReporter } from "@utils";

/**
 * The observability integration point for the admin app. No vendor ships
 * with the starter; see apps/web/src/lib/observability.ts for the wiring
 * pattern, which is identical here.
 */
export function installErrorReporter(reporter: ErrorReporter | null): void {
  setErrorReporter(reporter);
}

export function installDevelopmentReporter(): void {
  if (process.env.NODE_ENV !== "development") return;
  installErrorReporter({
    captureException: (error, context) => console.warn("[error-reporting]", error, context ?? ""),
    setUser: () => undefined,
  });
}
