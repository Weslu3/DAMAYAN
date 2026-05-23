$filePath = 'c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\DispatcherPortal.tsx'
$content = [System.IO.File]::ReadAllText($filePath)
$lines = $content -split '\r?\n'
$emojisFound = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '[\u2600-\u27BF]|[\uD83C-\uDBFF\uDC00-\uDFFF]') {
        Write-Host "$($i + 1): $($lines[$i].Trim())"
        $emojisFound = $true
    }
}
if (-not $emojisFound) {
    Write-Host "No emojis found using that regex, trying simple string matching for common ones..."
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match '👥|🚑|🚒|🚨|⚠️|✅|❌|🔥|👨‍⚕️|🧑‍⚕️|📍') {
            Write-Host "$($i + 1): $($lines[$i].Trim())"
        }
    }
}
