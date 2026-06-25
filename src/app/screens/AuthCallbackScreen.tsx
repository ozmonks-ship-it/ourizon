import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageLoader } from "../components/PageLoader";

export function AuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorDescription = params.get("error_description");

    if (errorDescription) {
      setError(errorDescription);
      return;
    }

    if (!params.get("code")) {
      setError("Missing authorization code. Please try signing in again.");
      return;
    }

    const supabase = createClient();

    // createBrowserClient exchanges the PKCE code automatically on init
    // (detectSessionInUrl). Calling exchangeCodeForSession again fails because
    // the verifier is already consumed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.replace("/");
      }
    });

    void supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (session) {
        window.location.replace("/");
      }
    });

    const timeout = window.setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sign-in failed. Please try again.");
      }
    }, 10_000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      {error ? (
        <div className="w-full max-w-sm text-center">
          <p className="text-destructive text-sm mb-4">{error}</p>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to sign in
          </a>
        </div>
      ) : (
        <PageLoader />
      )}
    </div>
  );
}
