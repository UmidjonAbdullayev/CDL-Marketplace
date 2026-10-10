import { useEffect } from "react";
import { isPlatformManager } from "../lib/account-capabilities";
import {
  playApprovalNotificationSound,
  preloadOrderNotificationSound,
  unlockOrderNotificationSound
} from "../lib/orderNotificationSound";
import type { SessionUser } from "../lib/session";
import { supabase } from "../lib/supabase";

type WalletDepositRow = {
  id: string;
  status: string;
  amount: number;
};

type RegistrationRow = {
  id: string;
  status: string;
  account_type: string;
  selected_plan: string | null;
};

export type ManagerPaymentAlertPayload =
  | { kind: "wallet_deposit"; id: string; amount: number }
  | { kind: "carrier_plan"; id: string; plan: string | null };

function notifyWalletDeposit(deposit: WalletDepositRow, onAlert?: (payload: ManagerPaymentAlertPayload) => void) {
  if (deposit.status !== "pending") return;
  const eventId = `mgr-wallet-${deposit.id}`;
  playApprovalNotificationSound(eventId);
  onAlert?.({ kind: "wallet_deposit", id: deposit.id, amount: deposit.amount });
}

function notifyCarrierPayment(account: RegistrationRow, onAlert?: (payload: ManagerPaymentAlertPayload) => void) {
  if (account.status !== "pending_payment" || account.account_type !== "carrier") return;
  const eventId = `mgr-carrier-${account.id}`;
  playApprovalNotificationSound(eventId);
  onAlert?.({ kind: "carrier_plan", id: account.id, plan: account.selected_plan });
}

/**
 * Unlocks payment sounds after the first click/tap/keypress (required by browsers).
 */
export function useManagerPaymentSoundUnlock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    preloadOrderNotificationSound();

    const unlock = () => unlockOrderNotificationSound();

    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);

    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [enabled]);
}

/**
 * Plays the Shopify-style chime when a wallet deposit or carrier plan payment needs manager approval.
 */
export function useManagerPaymentAlert(
  sessionUser: SessionUser | null,
  onNewPayment?: (payload: ManagerPaymentAlertPayload) => void
) {
  const isManager = isPlatformManager(sessionUser);

  useManagerPaymentSoundUnlock(isManager);

  useEffect(() => {
    if (!isManager || !supabase) return;

    const onWalletInsert = (payload: { new: WalletDepositRow }) => {
      notifyWalletDeposit(payload.new, onNewPayment);
    };

    const onRegistrationInsert = (payload: { new: RegistrationRow }) => {
      notifyCarrierPayment(payload.new, onNewPayment);
    };

    const onRegistrationUpdate = (payload: { old: RegistrationRow; new: RegistrationRow }) => {
      const prev = payload.old;
      const next = payload.new;
      if (prev.status === next.status) return;
      if (next.status === "pending_payment") {
        notifyCarrierPayment(next, onNewPayment);
      }
    };

    const channel = supabase
      .channel("manager-payment-alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wallet_deposits" },
        (payload) => onWalletInsert(payload as unknown as { new: WalletDepositRow })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "registration_accounts" },
        (payload) => onRegistrationInsert(payload as unknown as { new: RegistrationRow })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "registration_accounts" },
        (payload) => onRegistrationUpdate(payload as unknown as { old: RegistrationRow; new: RegistrationRow })
      )
      .subscribe();

    return () => {
      if (supabase) void supabase.removeChannel(channel);
    };
  }, [isManager, onNewPayment]);
}
