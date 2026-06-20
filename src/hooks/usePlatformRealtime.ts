import { useEffect } from "react";
import { subscribePlatformRealtime, type RealtimeTopic } from "../services/realtime";

export function usePlatformRealtime(
  handler: (topics: Set<RealtimeTopic>) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;
    return subscribePlatformRealtime(handler);
  }, [handler, enabled]);
}
