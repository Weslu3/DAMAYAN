$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
  Sort-Object RouteMetric, InterfaceMetric |
  Select-Object -First 1

if ($defaultRoute) {
  $lanAddress = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $defaultRoute.InterfaceIndex |
    Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" } |
    Select-Object -First 1
}

if (-not $lanAddress) {
  $lanAddress = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" } |
    Sort-Object @{ Expression = { if ($_.InterfaceAlias -match "Wi-Fi|Ethernet") { 0 } else { 1 } } }, InterfaceAlias |
    Select-Object -First 1
}

if (-not $lanAddress) {
  throw "No LAN IPv4 address was found. Connect this computer to Wi-Fi/Ethernet before starting Expo Go."
}

$lanIp = $lanAddress.IPAddress
$metroPort = 8081
$stalePorts = @(8081, 8082, 8083, 8084, 8085)
$staleListeners = Get-NetTCPConnection -LocalPort $stalePorts -ErrorAction SilentlyContinue |
  Where-Object { $_.State -eq "Listen" }

foreach ($listener in $staleListeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if ($process -and $process.CommandLine -match "frontend_mobile" -and $process.CommandLine -match "expo") {
    Write-Host "Stopping stale Expo server on port $($listener.LocalPort)."
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Start-Sleep -Seconds 1

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
$env:EXPO_PUBLIC_API_BASE_URL = "http://$($lanIp):3001/api"

Write-Host "Expo Go LAN host: $lanIp"
Write-Host "Mobile API base URL: $($env:EXPO_PUBLIC_API_BASE_URL)"
Write-Host "Expo Go URL: exp://$($lanIp):$metroPort"
Write-Host "Make sure the phone and this computer are on the same Wi-Fi network."

npx expo start --lan --port $metroPort --clear
