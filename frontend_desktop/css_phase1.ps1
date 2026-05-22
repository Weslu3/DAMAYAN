# Read the file preserving its exact encoding
$filePath = 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\dispatcher.css'
$bytes = [System.IO.File]::ReadAllBytes($filePath)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# 1. Prepend font import at the very top
$fontImport = "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`r`n`r`n"
$content = $fontImport + $content

# 2. Replace "Public Sans" with Inter in dp-page
$content = $content.Replace(
    'font-family: "Public Sans", sans-serif;',
    "font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;`r`n  -webkit-font-smoothing: antialiased;`r`n  -moz-osx-font-smoothing: grayscale;"
)

# 3. Replace shadow tokens
$content = $content.Replace(
    '--d-shadow: 0 8px 32px rgba(46, 125, 50, 0.04);',
    '--d-shadow: 0 8px 24px rgba(46, 125, 50, 0.05), 0 2px 6px rgba(46, 125, 50, 0.02);'
)
$content = $content.Replace(
    '--d-shadow-lg: 0 16px 48px rgba(46, 125, 50, 0.08);',
    "--d-shadow-lg: 0 16px 40px rgba(46, 125, 50, 0.08), 0 4px 12px rgba(46, 125, 50, 0.03);`r`n  --d-shadow-glow: 0 0 20px rgba(46, 125, 50, 0.15);`r`n  --d-shadow-glow-red: 0 0 20px rgba(211, 47, 47, 0.15);`r`n  --d-gradient-surface: linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(246,250,246,1) 100%);"
)

# 4. Upgrade sidebar styles - enhance active nav item with glow
$content = $content.Replace(
    '.dp-nav-item.active {
  background: var(--d-primary-light);
  color: var(--d-primary-deep);
  font-weight: 700;
}',
    '.dp-nav-item.active {
  background: linear-gradient(135deg, rgba(46, 125, 50, 0.08), rgba(46, 125, 50, 0.14));
  color: var(--d-primary-deep);
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(46, 125, 50, 0.12), 0 2px 8px rgba(46, 125, 50, 0.08);
}'
)

# 5. Upgrade sidebar active icon with stronger glow
$content = $content.Replace(
    '.dp-nav-item.active .dp-nav-icon {
  background: var(--d-primary);
  color: #ffffff !important;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.22);
}',
    '.dp-nav-item.active .dp-nav-icon {
  background: linear-gradient(135deg, var(--d-primary), var(--d-primary-deep));
  color: #ffffff !important;
  box-shadow: 0 4px 16px rgba(46, 125, 50, 0.35);
}'
)

# 6. Enhance topbar glassmorphism
$content = $content.Replace(
    'background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(46, 125, 50, 0.12);
  border-radius: 999px;
  box-shadow: 0 10px 28px rgba(46, 125, 50, 0.12);',
    'background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: 1px solid rgba(46, 125, 50, 0.10);
  border-radius: 999px;
  box-shadow: 0 8px 32px rgba(46, 125, 50, 0.10), 0 2px 8px rgba(0, 0, 0, 0.04);'
)

# 7. Upgrade clock to use JetBrains Mono
$content = $content.Replace(
    'font-family: "DM Mono", monospace;',
    "font-family: 'JetBrains Mono', 'DM Mono', monospace;"
)

# 8. Enhance the phase badge with pulse animation for active state
$content = $content.Replace(
    '.dp-phase-badge.active {
  background: var(--d-green-bg);
  color: var(--d-green);
  border: 1px solid rgba(46, 125, 50, 0.25);
}',
    '.dp-phase-badge.active {
  background: var(--d-green-bg);
  color: var(--d-green);
  border: 1px solid rgba(46, 125, 50, 0.25);
  animation: dp-badge-pulse 3s ease-in-out infinite;
}
@keyframes dp-badge-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.15); }
  50% { box-shadow: 0 0 0 6px rgba(46, 125, 50, 0); }
}'
)

# 9. Enhance status pill with animated glow border when active
$content = $content.Replace(
    '.dp-status-dot.active {
  background: var(--d-green);
  box-shadow: 0 0 8px rgba(46, 125, 50, 0.4);
  animation: dp-pulse 2s infinite;
}',
    '.dp-status-dot.active {
  background: var(--d-green);
  box-shadow: 0 0 10px rgba(46, 125, 50, 0.5);
  animation: dp-pulse 2s ease-in-out infinite;
}'
)

# Write the modified content back (preserving encoding)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllBytes($filePath, $utf8NoBom.GetBytes($content))

Write-Host "CSS Phase 1 (tokens, typography, sidebar, topbar) complete!"
Write-Host "File size: $($utf8NoBom.GetBytes($content).Length) bytes"
