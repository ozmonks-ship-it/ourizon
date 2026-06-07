import { OurizonLogo } from "../components/OurizonLogo";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export function LoginScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <OurizonLogo size={40} />
            <span className="text-3xl font-medium text-foreground">Ourizon</span>
          </div>
          <p className="text-muted-foreground text-sm mb-8">Forecast your future, together</p>

          <GoogleSignInButton />

          <p className="text-muted-foreground/60 text-xs mt-4">🔒 Private by default</p>
        </div>
      </div>
    </div>
  );
}
