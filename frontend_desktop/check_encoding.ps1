$b = [System.IO.File]::ReadAllBytes('c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\dispatcher.css')
Write-Host "First 6 bytes: $($b[0]),$($b[1]),$($b[2]),$($b[3]),$($b[4]),$($b[5])"
Write-Host "File size: $($b.Length)"

# Read as different encodings to see what we have
$content = [System.IO.File]::ReadAllText('c:\Users\Administrator\Documents\GitHub\DAMAYAN\frontend_desktop\app\dispatcher\dispatcher.css')
$lines = $content.Split("`n")
Write-Host "Line count: $($lines.Length)"
# Show first line chars as code points
$firstLine = $lines[0]
Write-Host "First line length: $($firstLine.Length)"
for ($i = 0; $i -lt [Math]::Min(20, $firstLine.Length); $i++) {
    Write-Host "Char $i : U+$([int][char]$firstLine[$i]).ToString('X4') = '$($firstLine[$i])'"
}
