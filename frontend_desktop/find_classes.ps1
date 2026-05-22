$matches = Select-String -Path 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\dispatcher.css' -Pattern 'dp-kpi|dp-card|dp-modal|dp-queue|dp-toast|dp-rescue|dp-incident|dp-empty|dp-badge|dp-progress' | Select-Object -First 40
foreach ($m in $matches) {
    Write-Host "$($m.LineNumber): $($m.Line.Trim().Substring(0, [Math]::Min(100, $m.Line.Trim().Length)))"
}
