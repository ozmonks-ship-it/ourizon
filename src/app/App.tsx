import { AppLayout } from "./components/AppLayout";
import { AssetsScreen } from "./screens/AssetsScreen";

export default function App() {
  return (
    <div className="dark">
      <div className="min-h-screen bg-background text-foreground">
        <AppLayout>
          <AssetsScreen />
        </AppLayout>
      </div>
    </div>
  );
}
