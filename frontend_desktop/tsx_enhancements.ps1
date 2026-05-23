$filePath = 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\DispatcherPortal.tsx'
$content = [System.IO.File]::ReadAllText($filePath)

# 1. Add CountUp component
$countUpComponent = @"
function CountUp({ end, duration = 1000 }: { end: number | string; duration?: number }) {
  const [count, setCount] = useState(0);
  const numEnd = typeof end === 'string' ? parseInt(end.replace(/,/g, ''), 10) : end;
  
  useEffect(() => {
    if (isNaN(numEnd)) return;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * numEnd));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(numEnd);
      }
    };
    window.requestAnimationFrame(step);
  }, [numEnd, duration]);
  
  if (isNaN(numEnd)) return <>{end}</>;
  return <>{count.toLocaleString()}</>;
}

function Toast({ msg, type = "success", duration = 3000 }: { msg: string; type?: "success" | "error" | "warning"; duration?: number }) {
"@

$content = $content.Replace('function Toast({ msg, type = "success", duration = 3000 }: { msg: string; type?: "success" | "error" | "warning"; duration?: number }) {', $countUpComponent)

# 2. Update Dashboard Greeting
$oldGreeting = @"
      <div className="dp-dash-greeting">
        <div className="dp-dash-greeting-date">{today}</div>
        <h1>Command Overview</h1>
        <p>Metro Cluster 3 - Sampaloc Command Center</p>
      </div>
"@
$newGreeting = @"
      <div className="dp-dash-greeting">
        <div className="dp-dash-greeting-date">{today}</div>
        <h1>
          {new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening"}, Dispatcher
        </h1>
        <p>Command Overview &bull; Metro Cluster 3 - Sampaloc</p>
      </div>
"@
$content = $content.Replace($oldGreeting, $newGreeting)

# 3. Use CountUp in stat values
$oldStatValue = @"
            <div className="dp-stat-value" style={{ color: s.color }}>
              {s.value}
            </div>
"@
$newStatValue = @"
            <div className="dp-stat-value" style={{ color: s.color }}>
              <CountUp end={s.value} />
            </div>
"@
$content = $content.Replace($oldStatValue, $newStatValue)

# 4. Critical priority queue row
$content = $content.Replace(
'          <div
            key={inc.id}
            className="dp-queue-row"
            onClick={() => {
              setViewingIncident(inc);
              setShowDetailModal(true);
            }}
          >',
'          <div
            key={inc.id}
            className={`dp-queue-row ${inc.priority === "CRITICAL" ? "critical-priority" : ""}`}
            onClick={() => {
              setViewingIncident(inc);
              setShowDetailModal(true);
            }}
          >'
)

# 5. Empty State icon
$oldEmpty1 = @"
            <div className="dp-empty">
              <div className="dp-empty-title">No critical active incidents</div>
              <div className="dp-empty-sub">All clear in this cluster</div>
            </div>
"@
$newEmpty1 = @"
            <div className="dp-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--d-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom: "1rem"}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <div className="dp-empty-title">No critical active incidents</div>
              <div className="dp-empty-sub">All clear in this cluster</div>
            </div>
"@
$content = $content.Replace($oldEmpty1, $newEmpty1)

$oldEmpty2 = @"
            <div className="dp-empty">
              <div className="dp-empty-title">No incidents match current filters</div>
"@
$newEmpty2 = @"
            <div className="dp-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--d-text-sub)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom: "1rem"}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <div className="dp-empty-title">No incidents match current filters</div>
"@
$content = $content.Replace($oldEmpty2, $newEmpty2)

[System.IO.File]::WriteAllText($filePath, $content)
Write-Host "TSX enhancements applied."
