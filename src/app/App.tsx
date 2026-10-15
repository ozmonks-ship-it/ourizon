import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppLayout, type NavScreen } from "./components/AppLayout";
import { AssetsScreen } from "./screens/AssetsScreen";
import { MonthlyPlanScreen } from "./screens/MonthlyPlanScreen";
import { BudgetsScreen } from "./screens/BudgetsScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { AppUpdateBanner } from "./components/AppUpdateBanner";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import { LoadingScreen } from "./components/LoadingScreen";
import { PageLoader } from "./components/PageLoader";
import { ToastProvider } from "./components/Toast";
import { bootstrapCollaboration } from "./lib/collaborationApi";
import { createClient } from "@/lib/supabase/client";

const INTRO_KEY = "ourizon-intro-shown";

/** The animated intro plays once per browser session, and never with reduced motion (A11). */
function shouldShowIntro(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return sessionStorage.getItem(INTRO_KEY) === null;
  } catch {
    return false;
  }
}

function markIntroShown() {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Storage blocked: the intro may show again next launch, which is harmless.
  }
}

export default function App() {
  const isAuthCallback = window.location.pathname === "/auth/callback";
  const [introLoading, setIntroLoading] = useState(() => !isAuthCallback && shouldShowIntro());
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(!isAuthCallback);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [screen, setScreen] = useState<NavScreen>("dashboard");
  const bootstrappedUserId = useRef<string | null>(null);

  useEffect(() => {
    // Radix dialogs portal to <body>, so the theme class must sit on <html> (A1).
    document.documentElement.classList.add("dark");
  }, []);

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
      // Supabase re-emits SIGNED_IN / TOKEN_REFRESHED whenever the app regains focus.
      // Only re-bootstrap when the user actually changes; otherwise the whole app would
      // unmount behind the loader and lose in-progress input on every app switch.
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== bootstrappedUserId.current) {
        bootstrappedUserId.current = nextUserId;
        setBootstrapped(false);
      }
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
      .finally(() => {
        bootstrappedUserId.current = session.user.id;
        setBootstrapped(true);
      });
  }, [session, bootstrapped]);

  if (isAuthCallback) {
    return (
      <>
        <AuthCallbackScreen />
        <AppUpdateBanner />
        <PwaInstallBanner />
      </>
    );
  }

  const showAuthLoader = !introLoading && authLoading;
  const showBootstrapLoader = !introLoading && !authLoading && !!session && !bootstrapped;
  const showApp = !authLoading && !!session && bootstrapped;
  const showLogin = !authLoading && !session;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {introLoading && (
        <LoadingScreen
          onDone={() => {
            markIntroShown();
            setIntroLoading(false);
          }}
        />
      )}

      {showLogin && (
        <>
          <LoginScreen />
          <AppUpdateBanner />
          <PwaInstallBanner />
        </>
      )}

      {showApp && (
        <>
          <ToastProvider>
            <AppLayout session={session} screen={screen} onNavigate={setScreen}>
              {screen === "dashboard" && <HomeScreen session={session} onNavigate={setScreen} />}
              {screen === "assets" && <AssetsScreen session={session} />}
              {screen === "monthly" && <MonthlyPlanScreen session={session} />}
              {screen === "budgets" && <BudgetsScreen session={session} />}
            </AppLayout>
          </ToastProvider>
          <AppUpdateBanner aboveNav />
          <PwaInstallBanner aboveNav />
        </>
      )}

      {showAuthLoader && <PageLoader overlay />}
      {showBootstrapLoader && <PageLoader overlay />}
    </div>
  );
}
