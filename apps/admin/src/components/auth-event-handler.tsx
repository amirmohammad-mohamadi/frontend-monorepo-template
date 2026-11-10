"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { API_UNAUTHORIZED_EVENT, authQueryKeys } from "@services";
import { PUBLIC_PATHS } from "@/lib/auth/config";
import { TEXTS } from "@/texts";

/** A 401 from any call ends the session: clear the client state and send the operator to sign in. */
export function AuthEventHandler() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.setQueryData(authQueryKeys.me(), null);
      if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return;
      toast.error(TEXTS.auth.sessionExpired);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    };
    window.addEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient, router, pathname]);

  return null;
}
