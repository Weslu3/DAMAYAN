$cssFile = 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\dispatcher.css'
$content = [System.IO.File]::ReadAllText($cssFile)

# Remove ::before pseudo elements
$content = $content -replace '(?s)\.dp-rescue-kpi-card::before \{.*?\}', '.dp-rescue-kpi-card::before { content: none; }'
$content = $content -replace '(?s)\.dp-rescue-kpi-card\.resolved::before \{.*?\}', '.dp-rescue-kpi-card.resolved::before { content: none; }'
$content = $content -replace '(?s)\.dp-rescue-kpi-card\.situation::before \{.*?\}', '.dp-rescue-kpi-card.situation::before { content: none; }'

# Remove background gradients
$content = $content -replace '(?s)\.dp-rescue-kpi-card\.active \{.*?\}', '.dp-rescue-kpi-card.active { background: var(--d-surface); }'
$content = $content -replace '(?s)\.dp-rescue-kpi-card\.resolved \{.*?\}', '.dp-rescue-kpi-card.resolved { background: var(--d-surface); }'

# Update top container
$oldTop = @"
.dp-rescue-kpi-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}
"@
$newTop = @"
.dp-rescue-kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}
"@
$content = $content.Replace($oldTop, $newTop)

# Update icon
$oldIcon = @"
.dp-rescue-kpi-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: rgba(46, 125, 50, 0.12);
  color: var(--d-primary);
}
"@
$newIcon = @"
.dp-rescue-kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(46, 125, 50, 0.12);
  color: var(--d-primary);
}
"@
$content = $content.Replace($oldIcon, $newIcon)

# Update label
$oldLabel = @"
.dp-rescue-kpi-label {
  min-width: 0;
  color: var(--d-text-muted);
  font-size: 0.76rem;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
"@
$newLabel = @"
.dp-rescue-kpi-label {
  font-weight: 700;
  color: var(--d-text-sub);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.2rem;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
"@
$content = $content.Replace($oldLabel, $newLabel)

# Update value
$oldValue = @"
.dp-rescue-kpi-value {
  margin-top: 0.45rem;
  color: var(--d-primary);
  font-size: 1.45rem;
  font-weight: 950;
  line-height: 1;
}
"@
$newValue = @"
.dp-rescue-kpi-value {
  margin-top: 0.45rem;
  color: var(--d-primary);
  font-size: 2.2rem;
  font-weight: 700;
  line-height: 1.1;
}
"@
$content = $content.Replace($oldValue, $newValue)

[System.IO.File]::WriteAllText($cssFile, $content)
Write-Host "Rescue KPI CSS updated successfully."
