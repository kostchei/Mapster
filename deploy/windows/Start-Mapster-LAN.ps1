param(
  [int]$Port = 8080,
  [switch]$NoOpenBrowser
)

$ErrorActionPreference = "Stop"

function Get-MapsterRoot {
  $root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
  return $root.Path
}

function Get-ContentType([string]$path) {
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  switch ($ext) {
    ".html" { return "text/html; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".csv" { return "text/csv; charset=utf-8" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".svg" { return "image/svg+xml" }
    ".webp" { return "image/webp" }
    ".ico" { return "image/x-icon" }
    ".txt" { return "text/plain; charset=utf-8" }
    ".md" { return "text/markdown; charset=utf-8" }
    default { return "application/octet-stream" }
  }
}

function Get-LanIPv4 {
  try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
      } |
      Sort-Object InterfaceMetric, SkipAsSource |
      Select-Object -ExpandProperty IPAddress -Unique
    if ($ips) {
      return $ips
    }
  } catch {
    # ignore and fallback
  }

  $fallback = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
    Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
    ForEach-Object { $_.ToString() } |
    Where-Object { $_ -notlike "127.*" } |
    Select-Object -Unique
  return $fallback
}

function Try-OpenFirewallPort([int]$port) {
  $ruleName = "Mapster LAN $port"
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    return
  }

  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if (-not $existing) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port | Out-Null
  }
}

function Write-Response {
  param(
    [Parameter(Mandatory = $true)] $Client,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8",
    [switch]$HeadOnly
  )

  $stream = $Client.GetStream()
  $writer = New-Object IO.StreamWriter($stream, [Text.Encoding]::ASCII, 1024, $true)
  $length = if ($Body) { $Body.Length } else { 0 }

  $writer.WriteLine("HTTP/1.1 $StatusCode $StatusText")
  $writer.WriteLine("Content-Type: $ContentType")
  $writer.WriteLine("Content-Length: $length")
  $writer.WriteLine("Cache-Control: no-cache")
  $writer.WriteLine("Connection: close")
  $writer.WriteLine()
  $writer.Flush()

  if (-not $HeadOnly -and $Body -and $Body.Length -gt 0) {
    $stream.Write($Body, 0, $Body.Length)
  }
}

$root = Get-MapsterRoot
$prototypeIndex = Join-Path $root "prototype\index.html"
if (-not (Test-Path $prototypeIndex)) {
  Write-Host "Could not find prototype entrypoint: $prototypeIndex" -ForegroundColor Red
  exit 1
}

Try-OpenFirewallPort -port $Port

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()

$ips = Get-LanIPv4
Write-Host ""
Write-Host "Mapster LAN server running from: $root" -ForegroundColor Green
Write-Host "Local URL:  http://localhost:$Port/prototype/"
foreach ($ip in $ips) {
  Write-Host "LAN URL:    http://$ip`:$Port/prototype/"
}
Write-Host ""
Write-Host "Keep this window open. Press Ctrl+C to stop."
Write-Host ""

if (-not $NoOpenBrowser) {
  Start-Process "http://localhost:$Port/prototype/"
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 8192, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        $client.Close()
        continue
      }

      $parts = $requestLine.Split(" ")
      if ($parts.Length -lt 2) {
        $body = [Text.Encoding]::UTF8.GetBytes("Bad Request")
        Write-Response -Client $client -StatusCode 400 -StatusText "Bad Request" -Body $body
        $client.Close()
        continue
      }

      $method = $parts[0].ToUpperInvariant()
      $rawTarget = $parts[1]

      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line -eq "") {
          break
        }
      }

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
        Write-Response -Client $client -StatusCode 405 -StatusText "Method Not Allowed" -Body $body
        $client.Close()
        continue
      }

      $pathPart = $rawTarget.Split("?", 2)[0]
      $decodedPath = [System.Uri]::UnescapeDataString($pathPart)
      if ([string]::IsNullOrWhiteSpace($decodedPath) -or $decodedPath -eq "/") {
        $decodedPath = "/prototype/"
      }
      if ($decodedPath.EndsWith("/")) {
        $decodedPath = "$decodedPath" + "index.html"
      }

      $relativePath = $decodedPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
      $candidate = [IO.Path]::GetFullPath((Join-Path $root $relativePath))
      $rootFull = [IO.Path]::GetFullPath($root + [IO.Path]::DirectorySeparatorChar)

      if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $body = [Text.Encoding]::UTF8.GetBytes("Forbidden")
        Write-Response -Client $client -StatusCode 403 -StatusText "Forbidden" -Body $body
        $client.Close()
        continue
      }

      if (-not (Test-Path $candidate -PathType Leaf)) {
        $body = [Text.Encoding]::UTF8.GetBytes("Not Found")
        Write-Response -Client $client -StatusCode 404 -StatusText "Not Found" -Body $body
        $client.Close()
        continue
      }

      $bytes = [IO.File]::ReadAllBytes($candidate)
      $contentType = Get-ContentType -path $candidate
      Write-Response -Client $client -StatusCode 200 -StatusText "OK" -Body $bytes -ContentType $contentType -HeadOnly:($method -eq "HEAD")
      $client.Close()
    } catch {
      try {
        $body = [Text.Encoding]::UTF8.GetBytes("Internal Server Error")
        Write-Response -Client $client -StatusCode 500 -StatusText "Internal Server Error" -Body $body
      } catch {
        # ignore
      }
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
