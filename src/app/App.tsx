import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppLayout, type NavScreen } from "./components/AppLayout";
import { AssetsScreen } from "./screens/AssetsScreen";
import { BucketsScreen } from "./screens/BucketsScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { AppUpdateBanner } from "./components/AppUpdateBanner";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import { LoadingScreen } from "./components/LoadingScreen";
import { PageLoader } from "./components/PageLoader";
import { bootstrapCollaboration } from "./lib/collaborationApi";
import { createClient } from "@/lib/supabase/client";

export default function App() {
  const isAuthCallback = window.location.pathname === "/auth/callback";
  const [introLoading, setIntroLoading] = useState(!isAuthCallback);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(!isAuthCallback);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [screen, setScreen] = useState<NavScreen>("dashboard");

  useEffect(() => {
    if (isAuthCallback) {
      return;
    }

    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
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

  const showAuthLoader = !introLoading && authLoading;
  const showBootstrapLoader = !introLoading && !authLoading && !!session && !bootstrapped;
  const showApp = !authLoading && !!session && bootstrapped;
  const showLogin = !authLoading && !session;

  return (
    <div className="dark">
      <div className="min-h-screen bg-background text-foreground">
        {introLoading && <LoadingScreen onDone={() => setIntroLoading(false)} />}

        {showLogin && (
          <>
            <LoginScreen />
            <AppUpdateBanner />
            <PwaInstallBanner />
          </>
        )}

        {showApp && (
          <>
            <AppLayout session={session} screen={screen} onNavigate={setScreen}>
              {screen === "dashboard" && <HomeScreen session={session} />}
              {screen === "assets" && <AssetsScreen session={session} />}
              {screen === "monthly" && <BucketsScreen session={session} />}
            </AppLayout>
            <AppUpdateBanner aboveNav />
            <PwaInstallBanner aboveNav />
          </>
        )}

        {showAuthLoader && <PageLoader overlay />}
        {showBootstrapLoader && <PageLoader overlay />}
      </div>
    </div>
  );
}
