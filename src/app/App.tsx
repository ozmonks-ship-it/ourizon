import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppLayout, type NavScreen } from "./components/AppLayout";
import { AssetsScreen } from "./screens/AssetsScreen";
import { BucketsScreen } from "./screens/BucketsScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { AppUpdateBanner } from "./components/AppUpdateBanner";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import { bootstrapCollaboration } from "./lib/collaborationApi";
import { createClient } from "@/lib/supabase/client";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [screen, setScreen] = useState<NavScreen>("assets");
  const isAuthCallback = window.location.pathname === "/auth/callback";

  useEffect(() => {
    if (isAuthCallback) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setBootstrapped(false);
    });

    return () => subscription.unsubscribe();
  }, [isAuthCallback]);

  useEffect(() => {
    if (!session || bootstrapped) return;

    void bootstrapCollaboration()
      .then((ready) => {
        if (!ready) {
          console.warn(
            "Collaboration schema not found — run supabase/migrations/20250608100000_collaboration.sql",
          );
        }
      })
      .catch((err) => console.error("Collaboration bootstrap failed:", err))
      .finally(() => setBootstrapped(true));
  }, [session, bootstrapped]);

  if (isAuthCallback) {
    return (
      <div className="dark">
        <AuthCallbackScreen />
        <AppUpdateBanner />
        <PwaInstallBanner />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="dark">
        <LoginScreen />
        <AppUpdateBanner />
        <PwaInstallBanner />
      </div>
    );
  }

  if (!bootstrapped) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="dark">
      <div className="min-h-screen bg-background text-foreground">
        <AppLayout session={session} screen={screen} onNavigate={setScreen}>
          {screen === "assets" && <AssetsScreen session={session} />}
          {screen === "monthly" && <BucketsScreen session={session} />}
        </AppLayout>
        <AppUpdateBanner aboveNav />
        <PwaInstallBanner aboveNav />
      </div>
    </div>
  );
}
