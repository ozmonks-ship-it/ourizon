import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_MS = 60 * 60 * 1000;

type AppUpdateEvent = "need-refresh" | "offline-ready";
type AppUpdateListener = (event: AppUpdateEvent) => void;

const listeners = new Set<AppUpdateListener>();

let reloadApp: ((reloadPage?: boolean) => Promise<void>) | undefined;
let initialized = false;

export function subscribeAppUpdates(listener: AppUpdateListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(event: AppUpdateEvent) {
  listeners.forEach((listener) => listener(event));
}

function scheduleUpdateChecks(registration: ServiceWorkerRegistration) {
  const check = () => void registration.update();

  window.setInterval(check, UPDATE_CHECK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

export function initServiceWorker() {
  if (initialized || !("serviceWorker" in navigator)) return;
  initialized = true;

  reloadApp = registerSW({
    immediate: true,
    onNeedRefresh() {
      notify("need-refresh");
    },
    onOfflineReady() {
      notify("offline-ready");
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) scheduleUpdateChecks(registration);
    },
  });
}

export function applyAppUpdate() {
  return reloadApp?.(true);
}
