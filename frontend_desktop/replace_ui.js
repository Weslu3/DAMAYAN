const fs = require('fs');

let code = fs.readFileSync('app/dispatcher/DispatcherPortal.tsx', 'utf-8');

const findNav = `  const NAV: { id: NavPage; icon: string; label: string; badge?: number }[] = [
    { id: "dashboard",         icon: "D", label: "Dashboard" },
    { id: "resource-map",      icon: "M", label: "Resource Map",       badge: newCount || undefined },
    { id: "rescue-monitoring", icon: "R", label: "Rescue Monitoring",  badge: activeCount || undefined },
    { id: "incidents",         icon: "I", label: "Incidents" },
    { id: "resources",         icon: "U", label: "Resources" },
  ];`;
const replaceNav = `  const NAV: { id: NavPage; icon: IconName; label: string; badge?: number }[] = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "resource-map", icon: "map", label: "Resource Map", badge: newCount || undefined },
    { id: "rescue-monitoring", icon: "activity", label: "Rescue Monitoring", badge: activeCount || undefined },
    { id: "incidents", icon: "ticket", label: "Incidents" },
    { id: "resources", icon: "users", label: "Resources" },
  ];`;
code = code.replace(findNav, replaceNav);

const findNavIcon = `              <span className="dp-nav-icon">{item.icon}</span>`;
const replaceNavIcon = `              <span className="dp-nav-icon"><Icon name={item.icon as IconName} size={18} /></span>`;
code = code.replace(findNavIcon, replaceNavIcon);

const findTopbar = `          <div className="dp-topbar-right">
            <span className="dp-clock">{clock}</span>`;
const replaceTopbar = `          <div className="dp-topbar-right">
            <div className="dp-vol-online-chip">
              <span className="dp-vol-online-dot"></span>
              {units.filter(u => u.status !== "Offline").length} Volunteers Online
            </div>
            <span className="dp-clock">{clock}</span>`;
code = code.replace(findTopbar, replaceTopbar);

const findResTeams = `function ResourcesPage({ units, setUnits, status }: { units: Unit[]; setUnits: React.Dispatch<React.SetStateAction<Unit[]>>; status: "active" | "inactive" }) {
  const isInactive = status === "inactive";
  const [tab, setTab] = useState<"teams"|"units">("teams");
  const [teams, setTeams] = useState(MOCK_TEAMS);`;
const replaceResTeams = `function ResourcesPage({ units, setUnits, status }: { units: Unit[]; setUnits: React.Dispatch<React.SetStateAction<Unit[]>>; status: "active" | "inactive" }) {
  const isInactive = status === "inactive";
  const [tab, setTab] = useState<"teams"|"units">("teams");
  const teams = volunteersToTeams(units);`;
code = code.replace(findResTeams, replaceResTeams);

const findTeamsRender = `      {/* Teams */}
      {tab==="teams"&&(
        <div className="dp-team-grid">
          {filteredTeams.map(team=>(
            <div key={team.id} className="dp-team-card" style={{ borderTopColor:TYPE_BORDER[team.type] }}>
              <div className="dp-team-card-header">
                <div>
                  <div className="dp-team-card-name">{UNIT_TYPE_ICON[team.type]} {team.name}</div>
                  <div className="dp-team-card-station">{team.station}</div>
                </div>
                <Badge label={team.status} cls={TEAM_STATUS_CLS[team.status]} />
              </div>
              <div className="dp-team-card-grid">
                {[["Leader",team.leader],["Contact",team.contact],["Members",\`\${team.members} personnel\`],["Vehicles",\`\${team.vehicles} units\`],["Coverage",team.coverage]].map(([l,v])=>(
                  <div key={l}><div className="dp-team-card-item-label">{l}</div><div className="dp-team-card-item-val">{v}</div></div>
                ))}
              </div>
              <div className="dp-equipment-list">
                {team.equipment.map(e=><span key={e} className="dp-equipment-tag">{e}</span>)}
              </div>
              <div className="dp-team-card-footer">
                <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={isInactive} style={isInactive ? { opacity: 0.5, cursor: "not-allowed" } : undefined} onClick={()=>toast.show(\`Message sent to \${team.name}\`)}>💬 Message</button>
                <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={isInactive} style={{ borderColor:"var(--d-red)",color:"var(--d-red)", opacity: isInactive ? 0.5 : 1, cursor: isInactive ? "not-allowed" : "pointer" }} onClick={()=>{setTeams(p=>p.filter(t=>t.id!==team.id));toast.show(\`\${team.name} removed\`);}}>🗑 Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}`;
const replaceTeamsRender = `      {/* Teams */}
      {tab==="teams"&&(
        <div className="dp-team-grid">
          {filteredTeams.map(team=>(
            <div key={team.id} className="dp-team-card-enhanced">
              <div className="dp-team-card-hero">
                <div className={\`dp-team-type-icon-lg \${team.type.toLowerCase()}\`}>
                  <Icon name={volunteerIconName(team.type as UnitType)} size={24} />
                </div>
                <div>
                  <div className="dp-team-card-title">{team.name}</div>
                  <div className="dp-team-card-sub">{team.station}</div>
                </div>
              </div>
              <div className="dp-team-card-body">
                <div className="dp-team-stat-grid">
                  <div className="dp-team-stat-box"><div className="dp-team-stat-label">Members</div><div className="dp-team-stat-val">{team.members}</div></div>
                  <div className="dp-team-stat-box"><div className="dp-team-stat-label">Status</div><div className="dp-team-stat-val" style={{ color: team.status === "Ready" ? "var(--d-green)" : "var(--d-text)" }}>{team.status}</div></div>
                  <div className="dp-team-stat-box"><div className="dp-team-stat-label">Contact</div><div className="dp-team-stat-val" style={{ fontSize: "0.8rem" }}>Bayanihub</div></div>
                </div>
                <button className="dp-btn dp-btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => toast.show(\`Message sent to \${team.name}\`)}>💬 Message Team</button>
              </div>
            </div>
          ))}
        </div>
      )}`;
code = code.replace(findTeamsRender, replaceTeamsRender);

fs.writeFileSync('app/dispatcher/DispatcherPortal.tsx', code);
