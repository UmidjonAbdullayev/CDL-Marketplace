export type WalletDepositTierId = "tier_1000" | "tier_2000";

export type WalletDepositOption = {
  id: WalletDepositTierId;
  amount: number;
  label: string;
  checkoutUrl: string;
};

export const WALLET_DEPOSIT_OPTIONS: WalletDepositOption[] = [
  {
    id: "tier_1000",
    amount: 1000,
    label: "$1,000 deposit",
    checkoutUrl: "https://whop.com/checkout/plan_Fj44oc6DraDKX"
  },
  {
    id: "tier_2000",
    amount: 2000,
    label: "$2,000 deposit",
    checkoutUrl: "https://whop.com/checkout/plan_3OurqFr1Wad58"
  }
];

export function walletDepositOptionByAmount(amount: number): WalletDepositOption | undefined {
  return WALLET_DEPOSIT_OPTIONS.find((o) => o.amount === amount);
}

export function walletDepositOptionById(id: WalletDepositTierId): WalletDepositOption | undefined {
  return WALLET_DEPOSIT_OPTIONS.find((o) => o.id === id);
}
