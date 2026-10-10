import { X } from "lucide-react";
import { useApp } from "../../context/AppContext";

export function Modal() {
  const { modal, closeModal } = useApp();

  return (
    <div
      className={`modal-overlay ${modal.open ? "open" : ""}`}
      id="modalOverlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeModal();
        }
      }}
    >
      <div className="modal" id="modal">
        <div className="modal-header">
          <h3 id="modalTitle">{modal.title}</h3>
          <button className="modal-close" id="modalClose" aria-label="Close" onClick={closeModal}>
            <X />
          </button>
        </div>
        <div className="modal-body" id="modalBody">{modal.body}</div>
        <div className="modal-footer" id="modalFooter">{modal.footer}</div>
      </div>
    </div>
  );
}
