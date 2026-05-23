$cssFile = 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\dispatcher.css'
$content = [System.IO.File]::ReadAllText($cssFile)

$oldStatBefore = @"
.dp-stat::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--d-primary);
  opacity: 0.8;
}
.dp-stat:nth-child(2)::before {
  background: var(--d-blue);
}
.dp-stat:nth-child(3)::before {
  background: var(--d-amber);
}
.dp-stat:nth-child(4)::before {
  background: var(--d-red);
}
"@
$content = $content.Replace($oldStatBefore, "/* .dp-stat::before styles removed for new design */")

$oldIconWrap = @"
.dp-stat-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--d-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.8rem;
}
"@
$newIconWrap = @"
.dp-stat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.dp-stat-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0;
}
"@
$content = $content.Replace($oldIconWrap, $newIconWrap)

$oldLabel = @"
.dp-stat-label {
  font-weight: 600;
  color: var(--d-text);
  font-size: 0.95rem;
  margin-bottom: 0.2rem;
  position: absolute;
  top: 1.2rem;
  left: 3.5rem;
}
"@
$newLabel = @"
.dp-stat-label {
  font-weight: 700;
  color: var(--d-text-sub);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0;
  margin-top: 0.2rem;
}
"@
$content = $content.Replace($oldLabel, $newLabel)

$oldValue = @"
.dp-stat-value {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
  margin-top: 1.5rem;
}
"@
$newValue = @"
.dp-stat-value {
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 0.2rem;
  line-height: 1.1;
}
"@
$content = $content.Replace($oldValue, $newValue)

[System.IO.File]::WriteAllText($cssFile, $content)
Write-Host "CSS updated successfully."
