import { useEffect } from "react";

/** Enables viewport-height scroll on registration routes (body is locked for the main app shell). */
export function useRegisterFlowScroll() {
  useEffect(() => {
    document.documentElement.classList.add("register-flow");
    document.body.classList.add("register-flow");
    return () => {
      document.documentElement.classList.remove("register-flow");
      document.body.classList.remove("register-flow");
    };
  }, []);
}
