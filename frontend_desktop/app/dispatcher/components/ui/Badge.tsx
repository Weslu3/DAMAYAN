export function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`dp-badge ${cls}`}>{label}</span>;
}
