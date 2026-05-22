export function Modal({
  title,
  onClose,
  width = 560,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="dp-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dp-modal" style={{ maxWidth: width }}>
        <div className="dp-modal-header">
          <span className="dp-modal-title">{title}</span>
          <button className="dp-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="dp-modal-body">{children}</div>
      </div>
    </div>
  );
}
