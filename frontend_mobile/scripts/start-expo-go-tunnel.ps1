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
$env:EXPO_PUBLIC_API_BASE_URL = "http://$($lanIp):3001/api"

Write-Host "Expo Go tunnel mode enabled."
Write-Host "Mobile API base URL: $($env:EXPO_PUBLIC_API_BASE_URL)"
Write-Host "Use this when Expo Go times out on LAN because Windows/network blocks direct phone access."

npx expo start --tunnel --port $metroPort --clear
