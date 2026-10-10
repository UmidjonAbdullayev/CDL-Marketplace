import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";

export function ToastContainer() {
  const { toasts } = useApp();

  return (
    <div className="toast-container" id="toastContainer">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast${toast.type ? ` ${toast.type}` : ""}`}>
          {toast.type === "success" ? <CheckCircle2 /> : toast.type === "error" ? <XCircle /> : <Info />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
