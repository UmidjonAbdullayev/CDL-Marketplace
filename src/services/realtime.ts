import { supabase } from "../lib/supabase";

/** Data domains that should refresh when underlying tables change. */
export type RealtimeTopic =
  | "dashboard"
  | "marketplace"
  | "deals"
  | "disputes"
  | "messages"
  | "notifications"
  | "my-listings"
  | "admin"
  | "purchased";

type RealtimeListener = (topics: Set<RealtimeTopic>) => void;

const TABLE_TOPICS: Record<string, RealtimeTopic[]> = {
  driver_listings: ["marketplace", "dashboard", "my-listings", "admin", "notifications"],
  deals: ["dashboard", "deals", "notifications", "admin", "marketplace"],
  deal_events: ["deals", "admin", "notifications", "dashboard"],
  deal_documents: ["deals", "admin"],
  messages: ["messages", "notifications"],
  conversations: ["messages", "notifications"],
  disputes: ["disputes", "dashboard", "notifications", "admin"],
  activities: ["dashboard", "notifications", "admin"],
  follow_ups: ["dashboard", "notifications"],
  reservations: ["my-listings", "marketplace", "dashboard"],
  purchases: ["purchased", "deals", "dashboard"],
  registration_accounts: ["admin", "notifications"],
  wallet_deposits: ["admin", "notifications"]
};

const REALTIME_TABLES = Object.keys(TABLE_TOPICS);

let hubChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
const listeners = new Set<RealtimeListener>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingTopics = new Set<RealtimeTopic>();

function flushPending() {
  debounceTimer = null;
  if (pendingTopics.size === 0) return;
  const batch = new Set(pendingTopics);
  pendingTopics.clear();
  listeners.forEach((listener) => listener(batch));
}

function queueTableChange(table: string) {
  const topics = TABLE_TOPICS[table];
  if (!topics?.length) return;
  topics.forEach((topic) => pendingTopics.add(topic));
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushPending, 250);
}

function ensureHubChannel() {
  if (!supabase || hubChannel) return;
  hubChannel = supabase.channel("cdl-exchange-platform-realtime");
  for (const table of REALTIME_TABLES) {
    hubChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => queueTableChange(table)
    );
  }
  hubChannel.subscribe();
}

/**
 * Subscribe to platform-wide Supabase Realtime events.
 * Returns an unsubscribe function.
 */
export function subscribePlatformRealtime(listener: RealtimeListener): () => void {
  if (!supabase) return () => {};
  listeners.add(listener);
  ensureHubChannel();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && hubChannel && supabase) {
      void supabase.removeChannel(hubChannel);
      hubChannel = null;
    }
  };
}

/** Subscribe to a single table (e.g. deal workspace scoped listeners). */
export function subscribeTableChanges(
  table: string,
  onChange: () => void,
  options?: { event?: "*" | "INSERT" | "UPDATE" | "DELETE"; filter?: string }
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`table-${table}-${options?.filter ?? "all"}-${Math.random().toString(36).slice(2, 8)}`)
    .on(
      "postgres_changes",
      {
        event: options?.event ?? "*",
        schema: "public",
        table,
        filter: options?.filter
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    if (supabase) void supabase.removeChannel(channel);
  };
}
