export type InvalidatableView =
  | "dashboard"
  | "marketplace"
  | "purchased"
  | "deals"
  | "disputes"
  | "messages"
  | "my-listings"
  | "admin";

type InvalidateFn = (views: InvalidatableView | InvalidatableView[]) => void;

let invalidateFn: InvalidateFn | null = null;

export function registerDataInvalidation(fn: InvalidateFn): () => void {
  invalidateFn = fn;
  return () => {
    if (invalidateFn === fn) invalidateFn = null;
  };
}

export function invalidateDataViews(views: InvalidatableView | InvalidatableView[]): void {
  invalidateFn?.(views);
}
