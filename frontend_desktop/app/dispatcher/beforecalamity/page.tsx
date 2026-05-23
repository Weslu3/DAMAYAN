"use client";

import { useMemo, useState } from "react";
import "../dispatcher.css";
import LiveMap from "../LiveMap";
import {
  BarangayDemographics,
  MOCK_BARANGAY_DATA,
  MOCK_INCIDENTS,
  MOCK_REPORTS,
  MOCK_TEAMS,
  MOCK_UNITS,
  PreparednessReport,
  Team,
} from "../data";

export default function BeforeCalamityPage() {
  const [query, setQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<PreparednessReport>(MOCK_REPORTS[0]);
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayDemographics>(MOCK_BARANGAY_DATA[0]);
  const [selectedTeamId, setSelectedTeamId] = useState(MOCK_TEAMS[0]?.id ?? "");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [showVulnerability, setShowVulnerability] = useState(true);
  const [showDensity, setShowDensity] = useState(true);

  const filteredReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return MOCK_REPORTS;
    return MOCK_REPORTS.filter((report) =>
      [report.id, report.title, report.summary, report.status].join(" ").toLowerCase().includes(needle),
    );
  }, [query]);

  const selectedTeam = MOCK_TEAMS.find((team) => team.id === selectedTeamId) as Team | undefined;

  const prePositionTeam = () => {
    if (!selectedTeam) return;
    setAssignments((current) => ({
      ...current,
      [selectedTeam.id]: selectedBarangay.name,
    }));
  };

  return (
    <div className="dp-page dp-before-page">
      <main className="dp-before-shell">
        <section className="dp-before-header">
          <div>
            <div className="dp-before-kicker">Before Calamity</div>
            <h1>Geographic Risk Mapping & Profiling</h1>
            <p>
              Review barangay vulnerability, density, preparedness reports, and standby team placement for Metro Cluster 3.
            </p>
          </div>
          <div className="dp-before-actions">
            <label className="dp-map-toggle">
              <input type="checkbox" checked={showVulnerability} onChange={(e) => setShowVulnerability(e.target.checked)} />
              Vulnerability
            </label>
            <label className="dp-map-toggle">
              <input type="checkbox" checked={showDensity} onChange={(e) => setShowDensity(e.target.checked)} />
              Density
            </label>
          </div>
        </section>

        <section className="dp-before-grid">
          <div className="dp-before-map">
            <LiveMap
              mode="risk-profile"
              incidents={MOCK_INCIDENTS}
              units={MOCK_UNITS}
              showVulnerabilityHeatmap={showVulnerability}
              showPopulationDensity={showDensity}
              onBarangayClick={setSelectedBarangay}
              height="100%"
            />
          </div>

          <aside className="dp-before-panel">
            <div className="dp-card">
              <div className="dp-card-header">
                <div>
                  <div className="dp-card-title">{selectedBarangay.name}</div>
                  <div className="dp-card-sub">Barangay demographic profile</div>
                </div>
                <span className={`dp-risk-profile-level ${selectedBarangay.riskLevel.toLowerCase()}`}>
                  {selectedBarangay.riskLevel}
                </span>
              </div>
              <div className="dp-risk-profile-grid">
                <div className="dp-risk-profile-stat"><span>Population</span><strong>{selectedBarangay.population.toLocaleString()}</strong></div>
                <div className="dp-risk-profile-stat"><span>Density</span><strong>{selectedBarangay.density.toLocaleString()}/km2</strong></div>
                <div className="dp-risk-profile-stat"><span>Elderly</span><strong>{selectedBarangay.elderly.toLocaleString()}</strong></div>
                <div className="dp-risk-profile-stat"><span>Infants</span><strong>{selectedBarangay.infants.toLocaleString()}</strong></div>
              </div>
            </div>

            <div className="dp-card">
              <div className="dp-card-header">
                <div>
                  <div className="dp-card-title">Pre-position Team</div>
                  <div className="dp-card-sub">Assign standby coverage before impact</div>
                </div>
              </div>
              <div className="dp-field">
                <label>Team</label>
                <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
                  {MOCK_TEAMS.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <button className="dp-btn dp-btn-green dp-before-wide-btn" onClick={prePositionTeam}>
                Set Standby Zone
              </button>
              <div className="dp-before-assignments">
                {Object.entries(assignments).map(([teamId, zone]) => {
                  const team = MOCK_TEAMS.find((item) => item.id === teamId);
                  return (
                    <div key={teamId} className="dp-risk-zone-row active">
                      <span>{team?.name ?? teamId}</span>
                      <strong>{zone}</strong>
                    </div>
                  );
                })}
                {Object.keys(assignments).length === 0 && (
                  <div className="dp-empty-sub">No teams pre-positioned yet.</div>
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className="dp-before-reports">
          <div className="dp-card">
            <div className="dp-card-header">
              <div>
                <div className="dp-card-title">Preparedness Reports</div>
                <div className="dp-card-sub">Safety audits and readiness assessments</div>
              </div>
              <input
                className="dp-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports..."
              />
            </div>
            <div className="dp-before-report-grid">
              <div className="dp-before-report-list">
                {filteredReports.map((report) => (
                  <button
                    key={report.id}
                    className={`dp-before-report-row ${selectedReport.id === report.id ? "active" : ""}`}
                    onClick={() => setSelectedReport(report)}
                  >
                    <span>{report.title}</span>
                    <strong>{report.status}</strong>
                  </button>
                ))}
              </div>
              <article className="dp-before-report-detail">
                <div className="dp-before-kicker">{selectedReport.id} - {selectedReport.date}</div>
                <h2>{selectedReport.title}</h2>
                <p>{selectedReport.summary}</p>
                <div className="dp-before-report-checks">
                  <span>Evacuation routes reviewed</span>
                  <span>Volunteer roster cross-checked</span>
                  <span>High-risk households prioritized</span>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
