$matches = Select-String -Path 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\DispatcherPortal.tsx' -Pattern 'dp-page-title|dp-page-header|function Dashboard|<h1|Welcome|greeting|dp-content' | Select-Object -First 20
foreach ($m in $matches) {
    $line = $m.Line.Trim()
    if ($line.Length -gt 120) { $line = $line.Substring(0, 120) + "..." }
    Write-Host "$($m.LineNumber): $line"
}
