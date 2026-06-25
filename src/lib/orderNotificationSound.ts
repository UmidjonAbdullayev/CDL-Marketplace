const SOUND_URL = "/sounds/shopify-order.m4a";
const PLAYED_KEY = "cdl_order_sound_played";

let audio: HTMLAudioElement | null = null;
let unlocked = false;
const pendingDealIds: string[] = [];

function readPlayedIds(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(PLAYED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markPlayed(dealId: string): void {
  const played = readPlayedIds();
  played.add(dealId);
  const list = [...played].slice(-100);
  sessionStorage.setItem(PLAYED_KEY, JSON.stringify(list));
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.volume = 0.85;
    audio.preload = "auto";
  }
  return audio;
}

function queueDeal(dealId: string): void {
  if (!pendingDealIds.includes(dealId) && !readPlayedIds().has(dealId)) {
    pendingDealIds.push(dealId);
  }
}

async function playInternal(dealId: string): Promise<boolean> {
  if (!dealId || readPlayedIds().has(dealId)) return false;
  try {
    const el = getAudio();
    el.currentTime = 0;
    await el.play();
    markPlayed(dealId);
    return true;
  } catch {
    queueDeal(dealId);
    return false;
  }
}

function flushPending(): void {
  const ids = [...pendingDealIds];
  pendingDealIds.length = 0;
  for (const id of ids) {
    void playInternal(id);
  }
}

/**
 * Browsers block audio until the user has interacted with the page.
 * Call once after pointer/keyboard input to unlock notification sounds.
 */
export function unlockOrderNotificationSound(): void {
  if (unlocked) {
    flushPending();
    return;
  }
  const el = getAudio();
  const volume = el.volume;
  el.volume = 0.001;
  el.currentTime = 0;
  void el
    .play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = volume;
      unlocked = true;
      flushPending();
    })
    .catch(() => {
      el.volume = volume;
    });
}

export function isOrderSoundUnlocked(): boolean {
  return unlocked;
}

export function hasPendingOrderSounds(): boolean {
  return pendingDealIds.length > 0;
}

/** Play once per deal id per browser session. */
export function playOrderNotificationSound(dealId: string): void {
  if (!dealId || readPlayedIds().has(dealId)) return;
  if (!unlocked) {
    queueDeal(dealId);
    return;
  }
  void playInternal(dealId);
}

/** Preload the sound file for recruiters (does not play). */
export function preloadOrderNotificationSound(): void {
  getAudio().load();
}

/** Alias for wallet deposits, carrier plan payments, and other manager approval alerts. */
export function playApprovalNotificationSound(eventId: string): void {
  playOrderNotificationSound(eventId);
}
