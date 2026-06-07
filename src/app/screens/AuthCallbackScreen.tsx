import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OurizonLogo } from "../components/OurizonLogo";

export function AuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description");

      if (errorDescription) {
        setError(errorDescription);
        return;
      }

      if (!code) {
        setError("Missing authorization code. Please try signing in again.");
        return;
      }

      const supabase = createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      window.location.replace("/");
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <OurizonLogo size={36} />
          <span className="text-xl font-medium text-foreground">Ourizon</span>
        </div>
        {error ? (
          <>
            <p className="text-destructive text-sm mb-4">{error}</p>
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
