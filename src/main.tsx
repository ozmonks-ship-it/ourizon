import { createRoot } from "react-dom/client";
import { initServiceWorker } from "./app/lib/serviceWorker";
import App from "./app/App";
import "./styles/index.css";

initServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
