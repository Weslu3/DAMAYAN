$filePath = 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\dispatcher.css'
$bytes = [System.IO.File]::ReadAllBytes($filePath)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# ═══════════════════════════════════════════════════════
# 1. STAT CARD ENHANCEMENTS - gradient overlay, shimmer hover
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-stat {
  background: var(--d-surface);
  border: 1px solid var(--d-border);
  border-radius: var(--d-radius);
  padding: 1.2rem 1.2rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(46, 125, 50, 0.03);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}',
    '.dp-stat {
  background: var(--d-gradient-surface);
  border: 1px solid var(--d-border);
  border-radius: var(--d-radius);
  padding: 1.2rem 1.2rem;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(46, 125, 50, 0.03);
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.25s ease;
}'
)

$content = $content.Replace(
    '.dp-stat:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(46, 125, 50, 0.06);
}',
    '.dp-stat:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 28px rgba(46, 125, 50, 0.10);
  border-color: var(--d-border-strong);
}
.dp-stat::after {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
  transition: left 0.5s ease;
  pointer-events: none;
}
.dp-stat:hover::after {
  left: 100%;
}'
)

# ═══════════════════════════════════════════════════════
# 2. CARD ENHANCEMENTS
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-card {
  background: var(--d-surface);
  border: 1px solid var(--d-border);
  border-radius: var(--d-radius);
  box-shadow: var(--d-shadow);
  overflow: hidden;
}',
    '.dp-card {
  background: var(--d-surface);
  border: 1px solid var(--d-border);
  border-radius: var(--d-radius);
  box-shadow: var(--d-shadow);
  overflow: hidden;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}
.dp-card:hover {
  box-shadow: 0 8px 28px rgba(46, 125, 50, 0.07);
}'
)

# ═══════════════════════════════════════════════════════
# 3. MODAL ENHANCEMENTS - scale-up + fade animation, accent strip
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    'background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 8000;
  padding: 1rem;
  box-sizing: border-box;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  backdrop-filter: blur(3px);',
    'background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 8000;
  padding: 1rem;
  box-sizing: border-box;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  backdrop-filter: blur(8px);
  animation: dp-overlay-in 0.2s ease-out;'
)

$content = $content.Replace(
    'box-shadow: 0 24px 80px rgba(12, 24, 44, 0.14);
  width: min(100%, 760px);
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: auto;
}',
    'box-shadow: 0 24px 80px rgba(12, 24, 44, 0.14), 0 8px 24px rgba(0, 0, 0, 0.06);
  width: min(100%, 760px);
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: auto;
  animation: dp-modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}'
)

# ═══════════════════════════════════════════════════════
# 4. TOAST REDESIGN - slide-in from top-right, icon + color variants
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--d-surface);
  border: 1px solid var(--d-border-strong);
  border-radius: var(--d-radius-sm);
  padding: 0.7rem 1.2rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--d-text);
  box-shadow: var(--d-shadow-lg);
  z-index: 9999;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}',
    '.dp-toast {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  left: auto;
  bottom: auto;
  transform: none;
  background: var(--d-surface);
  border: 1px solid var(--d-border-strong);
  border-radius: var(--d-radius);
  padding: 0.85rem 1.4rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--d-text);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  z-index: 9999;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  animation: dp-toast-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 400px;
}
.dp-toast.success {
  border-left: 4px solid var(--d-green);
}
.dp-toast.error {
  border-left: 4px solid var(--d-red);
}
.dp-toast.warning {
  border-left: 4px solid var(--d-amber);
}
.dp-toast.info {
  border-left: 4px solid var(--d-blue);
}'
)

# ═══════════════════════════════════════════════════════
# 5. QUEUE ROW ENHANCEMENTS - left-border accent on hover, better hover bg
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-queue-row {
  display: grid;
  grid-template-columns: 80px 140px 1fr 85px 105px 105px 155px;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  align-items: center;
  border-bottom: 1px solid var(--d-border);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}',
    '.dp-queue-row {
  display: grid;
  grid-template-columns: 80px 140px 1fr 85px 105px 105px 155px;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  align-items: center;
  border-bottom: 1px solid var(--d-border);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}'
)

$content = $content.Replace(
    '.dp-queue-row:hover {
  background: var(--d-primary-light);
}',
    '.dp-queue-row:hover {
  background: var(--d-primary-light);
  border-left-color: var(--d-primary);
}'
)

# Use JetBrains Mono for queue IDs
$content = $content.Replace(
    '.dp-queue-id {
  font-family: monospace;',
    '.dp-queue-id {
  font-family: ''JetBrains Mono'', monospace;'
)

# ═══════════════════════════════════════════════════════
# 6. BADGE ENHANCEMENTS - better contrast, hover effects
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}',
    '.dp-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  border: 1px solid transparent;
}
.dp-badge:hover {
  transform: scale(1.04);
}'
)

# Add borders to colored badges for better visual separation
$content = $content.Replace(
    '.dp-badge-red {
  background: var(--d-red-bg);
  color: var(--d-red);
}',
    '.dp-badge-red {
  background: var(--d-red-bg);
  color: var(--d-red);
  border-color: rgba(211, 47, 47, 0.15);
}'
)

$content = $content.Replace(
    '.dp-badge-amber {
  background: var(--d-amber-bg);
  color: var(--d-amber);
}',
    '.dp-badge-amber {
  background: var(--d-amber-bg);
  color: var(--d-amber);
  border-color: rgba(255, 179, 0, 0.2);
}'
)

$content = $content.Replace(
    '.dp-badge-green {
  background: var(--d-green-bg);
  color: var(--d-green);
}',
    '.dp-badge-green {
  background: var(--d-green-bg);
  color: var(--d-green);
  border-color: rgba(46, 125, 50, 0.15);
}'
)

# ═══════════════════════════════════════════════════════
# 7. TABLE ENHANCEMENTS - better row hover and alternating bg
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-table tr:hover td {
  background: var(--d-surface-low);
}',
    '.dp-table tr:hover td {
  background: var(--d-surface-low);
}
.dp-table tbody tr:nth-child(even) td {
  background: rgba(245, 247, 245, 0.5);
}
.dp-table tbody tr:nth-child(even):hover td {
  background: var(--d-surface-low);
}'
)

# ═══════════════════════════════════════════════════════
# 8. FORM / INPUT ENHANCEMENTS - animated focus ring
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-input:focus,
.dp-select:focus,
.dp-textarea:focus {
  border-color: var(--d-primary);
}',
    '.dp-input:focus,
.dp-select:focus,
.dp-textarea:focus {
  border-color: var(--d-primary);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.10);
}'
)

$content = $content.Replace(
    '.dp-field input:focus,
.dp-field textarea:focus,
.dp-field select:focus {
  border-color: var(--d-primary);
}',
    '.dp-field input:focus,
.dp-field textarea:focus,
.dp-field select:focus {
  border-color: var(--d-primary);
  box-shadow: 0 0 0 3px rgba(46, 125, 50, 0.10);
}'
)

# ═══════════════════════════════════════════════════════
# 9. CRITICAL ITEM pulse effect
# ═══════════════════════════════════════════════════════
$content = $content.Replace(
    '.dp-critical-item {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--d-border);
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  transition: background-color 0.2s ease;
}',
    '.dp-critical-item {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--d-border);
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  transition: background-color 0.2s ease;
  border-left: 3px solid transparent;
}
.dp-critical-item.critical-priority {
  border-left-color: var(--d-red);
  animation: dp-critical-pulse 3s ease-in-out infinite;
}'
)

# ═══════════════════════════════════════════════════════
# 10. APPEND ALL KEYFRAME ANIMATIONS AT END OF FILE
# ═══════════════════════════════════════════════════════
$animations = @"

/* ============================
   ENHANCED ANIMATIONS
   ============================ */
@keyframes dp-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dp-modal-in {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes dp-toast-in {
  from {
    opacity: 0;
    transform: translateX(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes dp-critical-pulse {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(211, 47, 47, 0.04); }
}

@keyframes dp-shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

@keyframes dp-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes dp-count-up {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Stat value animated entrance */
.dp-stat-value {
  animation: dp-count-up 0.4s ease-out;
}

/* Empty state enhancement */
.dp-empty-state {
  animation: dp-fade-in 0.4s ease-out;
}

/* Button press micro-interaction */
.dp-btn:active:not(:disabled) {
  transform: scale(0.97);
}

/* Smoother avatar dropdown */
.dp-avatar-dropdown {
  animation: dp-fade-in 0.15s ease-out;
}

/* Filter pill hover */
.dp-filter-pill:hover {
  border-color: var(--d-primary);
  color: var(--d-primary);
}

/* Modal close button hover */
.dp-modal-close:hover {
  background: var(--d-surface-mid);
  border-color: var(--d-border-strong);
  color: var(--d-text);
}
"@

$content = $content + $animations

# Write back
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllBytes($filePath, $utf8NoBom.GetBytes($content))

Write-Host "CSS Phase 2 (cards, modals, toast, queue, badges, animations) complete!"
Write-Host "File size: $($utf8NoBom.GetBytes($content).Length) bytes"
