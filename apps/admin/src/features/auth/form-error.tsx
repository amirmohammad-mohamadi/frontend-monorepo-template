import { ApiClientError, formatApiErrorDescription, isClientRejection } from "@services";

export function FormError({ error, fallback }: { error: unknown; fallback: string }) {
  if (!error) return null;
  const message = isClientRejection(error) ? error.message : fallback;
  const details = error instanceof ApiClientError ? formatApiErrorDescription(error.errors, " · ") : "";
  return (
    <div role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
      <p>{message}</p>
      {details && details !== message ? <p className="mt-1 opacity-80">{details}</p> : null}
    </div>
  );
}
