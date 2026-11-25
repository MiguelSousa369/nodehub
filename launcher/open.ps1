<#
.SYNOPSIS
    Abre o Claude Code ligado a uma máquina do nodehub.

.EXAMPLE
    .\abrir.ps1 nodehub://open?host=teste-srv
    .\abrir.ps1 teste-srv

    Chamado pelo protocolo nodehub:// (ver instalar-protocolo.ps1) ou diretamente.
#>
param([Parameter(Mandatory)][string]$Alvo)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

function Mostrar-Erro([string]$msg) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($msg, 'nodehub', 'OK', 'Error') | Out-Null
    exit 1
}

# 1. Extrair o host (aceita "nodehub://open?host=X", "nodehub://open/?host=X" ou só "X")
if ($Alvo -match '^nodehub:') {
    if ($Alvo -notmatch '[?&]host=([^&/]+)') { Mostrar-Erro "Link inválido: $Alvo" }
    $hostName = [uri]::UnescapeDataString($Matches[1])
} else {
    $hostName = $Alvo
}

# 2. Validar: o link pode vir de qualquer página web, por isso só aceitamos nomes simples
#    e máquinas que estejam configuradas em maquinas.json.
if ($hostName -notmatch '^[A-Za-z0-9-]{1,63}$') { Mostrar-Erro "Nome de máquina inválido: $hostName" }

$maquinas = Get-Content (Join-Path $repo 'maquinas.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$cfg = $maquinas.PSObject.Properties | Where-Object { $_.Name -ieq $hostName } | Select-Object -First 1
if (-not $cfg) { Mostrar-Erro "A máquina '$hostName' não está em maquinas.json." }
$hostName   = $cfg.Name
$cliente    = $cfg.Value.cliente
$utilizador = $cfg.Value.utilizador

foreach ($v in @($cliente, $utilizador)) {
    if ($v -match '["`;$]') { Mostrar-Erro "Caracteres inválidos em maquinas.json para '$hostName'." }
}

# 3. IP Tailscale (informativo; se falhar, segue sem ele)
$ip = '?'
try {
    $ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    $estado = & $ts status --json | ConvertFrom-Json
    $peer = $estado.Peer.PSObject.Properties.Value | Where-Object { $_.HostName -ieq $hostName } | Select-Object -First 1
    if ($peer) { $ip = $peer.TailscaleIPs[0] }
} catch { }

# 4. Abrir o Claude Code na pasta do repositório, já com o contexto da máquina
$prompt = "Helpdesk: cliente $cliente, máquina $hostName ($ip, utilizador $utilizador). " +
          "Inicia a sessão como indicado no CLAUDE.md e depois pergunta-me qual é o problema."

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
