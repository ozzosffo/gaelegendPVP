$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$port = 3000
while (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  $port += 1
}

$url = "http://127.0.0.1:$port/"
Write-Host ""
Write-Host "개레전드 PVP 로컬 사이트를 시작합니다."
Write-Host "주소: $url"
Write-Host ""
Write-Host "이 창을 닫으면 사이트도 꺼집니다."
Write-Host "계속 켜두고 게임하세요."
Write-Host ""

Start-Process $url
python -m http.server $port -d public
