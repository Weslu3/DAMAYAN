$filePath = 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\DispatcherPortal.tsx'
$content = [System.IO.File]::ReadAllText($filePath)

$oldActiveTop = @"
          <div className="dp-rescue-kpi-top">
            <span className="dp-rescue-kpi-icon">
              <Icon name="activity" size={18} />
            </span>
            <span className="dp-rescue-kpi-label">Active Response</span>
          </div>
"@
$newActiveTop = @"
          <div className="dp-rescue-kpi-top">
            <span className="dp-rescue-kpi-label">Active Response</span>
            <span className="dp-rescue-kpi-icon">
              <Icon name="activity" size={18} />
            </span>
          </div>
"@
$content = $content.Replace($oldActiveTop, $newActiveTop)

$oldClosedTop = @"
          <div className="dp-rescue-kpi-top">
            <span className="dp-rescue-kpi-icon">
              <Icon name="check" size={18} />
            </span>
            <span className="dp-rescue-kpi-label">Closed Cases</span>
          </div>
"@
$newClosedTop = @"
          <div className="dp-rescue-kpi-top">
            <span className="dp-rescue-kpi-label">Closed Cases</span>
            <span className="dp-rescue-kpi-icon">
              <Icon name="check" size={18} />
            </span>
          </div>
"@
$content = $content.Replace($oldClosedTop, $newClosedTop)

$oldSituationTop = @"
            <div className="dp-rescue-kpi-top">
              <span className="dp-rescue-kpi-dot" style={{ backgroundColor: s.color }} />
              <span className="dp-rescue-kpi-label" style={{ color: "var(--d-text)" }}>
                {s.label}
              </span>
            </div>
"@
$newSituationTop = @"
            <div className="dp-rescue-kpi-top">
              <span className="dp-rescue-kpi-label">
                {s.label}
              </span>
              <span className="dp-rescue-kpi-dot" style={{ backgroundColor: s.color }} />
            </div>
"@
$content = $content.Replace($oldSituationTop, $newSituationTop)

[System.IO.File]::WriteAllText($filePath, $content)
Write-Host "TSX updated successfully."
