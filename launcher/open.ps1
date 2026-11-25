<#
.SYNOPSIS
    Opens Claude Code connected to a nodehub machine.

.EXAMPLE
    .\open.ps1 "nodehub://open?host=srv-bakery&client=Silva%20Bakery&user=nodehub"

    Called by the nodehub:// protocol (see register-protocol.ps1); the dashboard builds the link.
#>
param([Parameter(Mandatory)][string]$Target)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

function Show-Error([string]$msg) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($msg, 'nodehub', 'OK', 'Error') | Out-Null
    exit 1
}

function Get-Param([string]$name) {
    if ($Target -match "[?&]$name=([^&]*)") { return [uri]::UnescapeDataString($Matches[1].Replace('+', ' ')) }
    return ''
}

# 1. Read and validate the link. Links can come from any web page, so every value is
#    checked and the host must be a client machine in our tailnet (step 2).
if ($Target -notmatch '^nodehub://open/?\?') { Show-Error "Invalid link: $Target" }
$hostName = Get-Param 'host'
$client   = Get-Param 'client'
$sshUser  = Get-Param 'user'

if ($hostName -notmatch '^[A-Za-z0-9-]{1,63}$') { Show-Error "Invalid machine name: $hostName" }
if ($sshUser  -notmatch '^[A-Za-z0-9._-]{1,64}$') { Show-Error "Invalid SSH user: $sshUser" }
if ($client.Length -lt 1 -or $client.Length -gt 100 -or $client -match '["`;$\r\n]') { Show-Error 'Invalid client name.' }

# 2. The host must be in the tailnet with the client tag (CLIENT_TAG in backend/.env, default tag:client)
$clientTag = 'tag:client'
$envFile = Join-Path $repo 'backend\.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*CLIENT_TAG\s*=\s*(tag:[A-Za-z0-9-]+)\s*$') { $clientTag = $Matches[1] }
    }
}
try {
    $ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    $status = & $ts status --json | ConvertFrom-Json
} catch {
    Show-Error "Could not read Tailscale status: $($_.Exception.Message)"
}
$peer = $status.Peer.PSObject.Properties.Value |
    Where-Object { ($_.DNSName -split '\.')[0] -ieq $hostName } | Select-Object -First 1
if (-not $peer -or @($peer.Tags) -notcontains $clientTag) {
    Show-Error "Machine '$hostName' is not a client machine in the tailnet."
}
$ip = $peer.TailscaleIPs[0]

# 3. Make sure this PC is connected to nodehub (so Claude can read and record history).
#    If not, run "nodehub login" in a visible window: it opens the browser to approve this PC.
$cli = Join-Path $repo 'backend\dist\cli\nodehub.js'
if (Test-Path $cli) {
    & node $cli whoami --quiet 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Start-Process cmd.exe -Wait -ArgumentList '/c', "title nodehub: connect this PC & node `"$cli`" login & timeout /t 4 >nul"
    }
}

# 4. Open Claude Code in the repository folder with the machine context
$prompt = "Helpdesk: client $client, machine $hostName ($ip, user $sshUser). " +
          "Start the session as described in CLAUDE.md, then ask me what the problem is."

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if ($wt) {
    Start-Process $wt.Source -ArgumentList @(
        'new-tab', '--title', "`"nodehub: $hostName`"",
        '-d', "`"$repo`"",
        'claude.exe', "`"$prompt`""
    )
} else {
    Start-Process claude.exe -WorkingDirectory $repo -ArgumentList "`"$prompt`""
}
