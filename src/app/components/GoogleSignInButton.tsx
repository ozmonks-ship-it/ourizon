import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.8h5.38a4.6 4.6 0 01-2 3.02v2.52h3.22c1.89-1.73 2.98-4.28 2.98-7.34z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.22-2.52c-.9.6-2.04.96-3.4.96-2.6 0-4.82-1.76-5.6-4.13H1.08v2.6A10 10 0 0010 20z"
        fill="#34A853"
      />
      <path
        d="M4.4 11.88A5.98 5.98 0 014.08 10c0-.65.11-1.28.32-1.88V5.52H1.08A10 10 0 000 10c0 1.6.38 3.12 1.08 4.48l3.32-2.6z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.96a5.4 5.4 0 013.82 1.5l2.86-2.86A9.6 9.6 0 0010 0 10 10 0 001.08 5.52l3.32 2.6C5.18 5.72 7.4 3.96 10 3.96z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-foreground text-background font-medium rounded-xl py-3.5 hover:opacity-90 active:scale-[0.98] transition-all duration-150 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <GoogleIcon />
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && <p className="text-destructive text-xs mt-3">{error}</p>}
    </div>
  );
}
