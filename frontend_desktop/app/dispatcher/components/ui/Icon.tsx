export type IconName =
  | "dashboard"
  | "map"
  | "activity"
  | "ticket"
  | "users"
  | "profile"
  | "logout"
  | "megaphone"
  | "field"
  | "medic"
  | "logistics"
  | "search"
  | "message"
  | "trash"
  | "check"
  | "warning"
  | "back"
  | "pin";

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="8" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="15" width="7" height="6" rx="1.5" />
      </>
    ),
    map: (
      <>
        <path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </>
    ),
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    ticket: (
      <>
        <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Z" />
        <path d="M9 9h6" />
        <path d="M9 15h6" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </>
    ),
    megaphone: (
      <>
        <path d="m3 11 18-5v12L3 13v-2Z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </>
    ),
    field: (
      <>
        <path d="M12 2v20" />
        <path d="M5 7h14" />
        <path d="M7 22h10" />
        <path d="M8 7l4-5 4 5" />
      </>
    ),
    medic: (
      <>
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <rect x="5" y="5" width="14" height="14" rx="3" />
      </>
    ),
    logistics: (
      <>
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    message: (
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
      </>
    ),
    check: <><path d="m20 6-11 11-5-5" /></>,
    warning: (
      <>
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}
