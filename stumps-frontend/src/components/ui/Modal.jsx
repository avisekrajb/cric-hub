export default function Modal({ onClose, label, children }) {
  return (
    <div className="bg" onClick={onClose}>
      <div className="dlg" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
