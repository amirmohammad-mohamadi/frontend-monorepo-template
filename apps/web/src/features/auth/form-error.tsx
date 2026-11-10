import { ApiClientError, formatApiErrorDescription } from "@services";

/** The error block under an auth form: the backend's message for a refused request, a fallback otherwise. */
export function FormError({ error, fallback }: { error: unknown; fallback: string }) {
  if (!error) return null;
  const refused = error instanceof ApiClientError && error.statusCode >= 400 && error.statusCode < 500;
  const message = refused ? error.message : fallback;
  const details = error instanceof ApiClientError ? formatApiErrorDescription(error.errors, " · ") : "";
  return (
    <div role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
      <p>{message}</p>
      {details && details !== message ? <p className="mt-1 opacity-80">{details}</p> : null}
    </div>
  );
}
