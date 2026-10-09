import { OurizonLogo } from "../components/OurizonLogo";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export function LoginScreen() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-2xl p-8 text-center flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-2">
              <OurizonLogo size={40} />
              <h1 className="text-3xl font-semibold text-foreground" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                Ourizon
              </h1>
            </div>
            <p className="text-muted-foreground text-base">Forecast your future, together</p>
          </div>

          <p className="text-base text-foreground">
            See what your household owns, plan each month's income, and track spending for big
            occasions.
          </p>

          <GoogleSignInButton />

          <p className="text-muted-foreground text-sm">
            Only you can see your data, unless you add someone to your household.
          </p>
        </div>
      </div>
    </main>
  );
}
