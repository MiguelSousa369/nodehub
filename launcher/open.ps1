<#
.SYNOPSIS
    Opens Claude Code connected to a nodehub machine.

.EXAMPLE
    .\open.ps1 "nodehub://open?host=srv-bakery&user=nodehub"

    Called by the nodehub:// protocol (see register-protocol.ps1); the dashboard builds the link.
#>
param([Parameter(Mandatory)][string]$Target)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$cli  = Join-Path $repo 'backend\dist\cli\nodehub.js'

# Messages in the team language ("nodehub language" prints en or pt; English if it can't tell)
$Messages = @{
    en = @{
        InvalidLink    = 'Invalid nodehub link.'
        InvalidHost    = 'Invalid machine name in the link.'
        InvalidUser    = 'Invalid SSH user in the link.'
        TailscaleError = 'Could not read Tailscale status: {0}'
        NotClient      = "Machine '{0}' is not a client machine in the tailnet."
        ConnectTitle   = 'nodehub: connect this PC'
        Prompt         = 'Helpdesk: machine {0} ({1}, user {2}). Start the session as described in CLAUDE.md, then ask me what the problem is.'
    }
    pt = @{
        InvalidLink    = 'Link do nodehub inválido.'
        InvalidHost    = 'Nome de máquina inválido no link.'
        InvalidUser    = 'Utilizador SSH inválido no link.'
        TailscaleError = 'Não foi possível ler o estado do Tailscale: {0}'
        NotClient      = "A máquina '{0}' não é uma máquina cliente na tailnet."
        ConnectTitle   = 'nodehub: ligar este PC'
        Prompt         = 'Helpdesk: máquina {0} ({1}, utilizador {2}). Começa a sessão como descrito no CLAUDE.md e depois pergunta-me qual é o problema.'
    }
}
# Team language and client tag come from the nodehub server this PC is connected to ("nodehub
# launcher-info" prints e.g. "pt tag:client"), so technician PCs need no backend\.env.
$lang = 'en'
$serverTag = ''
if (Test-Path $cli) {
    try {
        $info = (& node $cli launcher-info 2>$null | Out-String).Trim() -split '\s+'
        if ($Messages.ContainsKey($info[0])) { $lang = $info[0] }
        if ($info.Count -gt 1 -and $info[1] -match '^tag:[A-Za-z0-9-]+$') { $serverTag = $info[1] }
    } catch { }
}
$T = $Messages[$lang]

function Show-Error([string]$msg) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($msg, 'nodehub', 'OK', 'Error') | Out-Null
    exit 1
}

function Get-Param([string]$name) {
    if ($Target -match "[?&]$name=([^&]*)") { return [uri]::UnescapeDataString($Matches[1].Replace('+', ' ')) }
    return ''
}

# 1. Read and validate the link. Links can come from any web page, so only two strictly
#    checked values are used, and the host must be a client machine in our tailnet (step 2).
#    No free text from the link reaches Claude: the client name comes from nodehub itself
#    ("nodehub machine <host>", the first step in CLAUDE.md). Older links with &client= still work;
#    that value is ignored.
if ($Target -notmatch '^nodehub://open/?\?') { Show-Error $T.InvalidLink }
$hostName = Get-Param 'host'
$sshUser  = Get-Param 'user'

if ($hostName -notmatch '^[A-Za-z0-9-]{1,63}$') { Show-Error $T.InvalidHost }
if ($sshUser  -notmatch '^[A-Za-z0-9._-]{1,64}$') { Show-Error $T.InvalidUser }

# 2. The host must be in the tailnet with the client tag (from the server; else CLIENT_TAG in
#    backend\.env on this PC; else tag:client)
$clientTag = 'tag:client'
$envFile = Join-Path $repo 'backend\.env'
if ($serverTag) {
    $clientTag = $serverTag
} elseif (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*CLIENT_TAG\s*=\s*(tag:[A-Za-z0-9-]+)\s*$') { $clientTag = $Matches[1] }
    }
}
try {
    $ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    $status = & $ts status --json | ConvertFrom-Json
} catch {
    Show-Error ($T.TailscaleError -f $_.Exception.Message)
}
$peer = $status.Peer.PSObject.Properties.Value |
    Where-Object { ($_.DNSName -split '\.')[0] -ieq $hostName } | Select-Object -First 1
if (-not $peer -or @($peer.Tags) -notcontains $clientTag) {
    Show-Error ($T.NotClient -f $hostName)
}
$ip = $peer.TailscaleIPs[0]

# 3. Make sure this PC is connected to nodehub (so Claude can read and record history).
#    If not, run "nodehub login" in a visible window: it opens the browser to approve this PC.
if (Test-Path $cli) {
    & node $cli whoami --quiet 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Start-Process cmd.exe -Wait -ArgumentList '/c', "title $($T.ConnectTitle) & node `"$cli`" login & timeout /t 4 >nul"
    }
}

# 4. Open Claude Code in the repository folder with the machine context
$prompt = $T.Prompt -f $hostName, $ip, $sshUser

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
