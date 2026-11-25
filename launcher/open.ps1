<#
.SYNOPSIS
    Opens Claude Code connected to a nodehub machine.

.EXAMPLE
    .\open.ps1 nodehub://open?host=teste-srv
    .\open.ps1 teste-srv

    Called by the nodehub:// protocol (see register-protocol.ps1) or directly.
#>
param([Parameter(Mandatory)][string]$Target)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$machinesDir = Join-Path $repo 'backend\data\machines'

function Show-Error([string]$msg) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($msg, 'nodehub', 'OK', 'Error') | Out-Null
    exit 1
}

# 1. Extract the host (accepts "nodehub://open?host=X", "nodehub://open/?host=X" or just "X")
if ($Target -match '^nodehub:') {
    if ($Target -notmatch '[?&]host=([^&/]+)') { Show-Error "Invalid link: $Target" }
    $hostName = [uri]::UnescapeDataString($Matches[1])
} else {
    $hostName = $Target
}

# 2. Validate: links can come from any web page, so only simple names of
#    machines configured in the dashboard are accepted.
if ($hostName -notmatch '^[A-Za-z0-9-]{1,63}$') { Show-Error "Invalid machine name: $hostName" }

$dir = Get-ChildItem $machinesDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ieq $hostName } | Select-Object -First 1
$entity = if ($dir) { Join-Path $dir.FullName 'entity.json' }
if (-not $entity -or -not (Test-Path $entity)) { Show-Error "Machine '$hostName' is not configured in the dashboard." }

$hostName = $dir.Name
$config   = Get-Content $entity -Raw -Encoding UTF8 | ConvertFrom-Json
$client   = $config.client
$sshUser  = $config.sshUser

foreach ($v in @($client, $sshUser)) {
    if ($v -match '["`;$]') { Show-Error "Invalid characters in the configuration of '$hostName'." }
}

# 3. Tailscale IP (informational; carries on without it on failure)
$ip = '?'
try {
    $ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    $status = & $ts status --json | ConvertFrom-Json
    $peer = $status.Peer.PSObject.Properties.Value |
        Where-Object { ($_.DNSName -split '\.')[0] -ieq $hostName } | Select-Object -First 1
    if ($peer) { $ip = $peer.TailscaleIPs[0] }
} catch { }

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
