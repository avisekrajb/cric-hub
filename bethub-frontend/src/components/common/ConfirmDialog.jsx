import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

export default function ConfirmDialog({ open, onClose, onConfirm, title = "Are you sure?", text, confirmLabel = "Confirm", danger = true, loading = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className={danger ? "btn bg-coral text-white hover:bg-coral/85" : "btn-primary"} onClick={onConfirm} disabled={loading}>
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex gap-3">
        <span className="mt-0.5 text-coral"><AlertTriangle size={20} /></span>
        <p className="text-sm leading-relaxed text-white/65">{text || "This action cannot be undone."}</p>
      </div>
    </Modal>
  );
}
