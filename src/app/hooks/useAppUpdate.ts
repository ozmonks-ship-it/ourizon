import { useCallback, useEffect, useState } from "react";
import { applyAppUpdate, subscribeAppUpdates } from "../lib/serviceWorker";

export function useAppUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => subscribeAppUpdates((event) => {
    if (event === "need-refresh") setNeedRefresh(true);
  }), []);

  const refresh = useCallback(() => {
    void applyAppUpdate();
  }, []);

  const dismiss = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  return { needRefresh, refresh, dismiss };
}
