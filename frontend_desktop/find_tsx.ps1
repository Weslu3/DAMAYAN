$matches = Select-String -Path 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\DispatcherPortal.tsx' -Pattern 'function Toast|const Toast|<Toast |showToast|Good Morning|Good Afternoon|dp-greeting|dp-stat-value|dp-queue-row|dp-empty|dp-critical-item' | Select-Object -First 30
foreach ($m in $matches) {
    $line = $m.Line.Trim()
    if ($line.Length -gt 120) { $line = $line.Substring(0, 120) + "..." }
    Write-Host "$($m.LineNumber): $line"
}
