<#
.SYNOPSIS
    Prepara um PC de cliente para o helpdesk do nodehub.

.DESCRIPTION
    - Instala o Tailscale (modo unattended) e liga-o à tailnet com a tag:cliente
    - Cria o utilizador local "nodehub" (administrador, escondido do ecrã de login, sem password conhecida)
    - Instala o OpenSSH Server, só com autenticação por chave
    - Firewall: SSH só a partir da tailnet (100.64.0.0/10)

    Este ficheiro é um MODELO. O instalador a usar no cliente descarrega-se no painel
    ("Adicionar máquina"), já com a chave do Tailscale e as chaves SSH preenchidas.
    No fim, o instalador apaga-se a si próprio (contém a chave do Tailscale).

.NOTES
    Executar com: botão direito > "Executar com o PowerShell". Pede elevação sozinho.
    Por SSH (já elevado): powershell -ExecutionPolicy Bypass -File nodehub-instalar.ps1 -SemPausa
#>
param(
    [string]   $AuthKey    = '__NODEHUB_AUTHKEY__',
    [string[]] $PublicKeys = @('__NODEHUB_PUBKEYS__'),
    [switch]   $SemPausa   # não esperar por Enter no fim (execução remota/automática)
)

$ErrorActionPreference = 'Stop'
$UserName = 'nodehub'

# --- 0. Elevação ---------------------------------------------------------------
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

function Passo($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Terminar($ok) {
    try { Stop-Transcript | Out-Null } catch { }
    # O instalador tem a chave do Tailscale: não deixar ficar na máquina
    if ($PSCommandPath -and (Test-Path $PSCommandPath) -and $PSCommandPath -notmatch '\\instalador\\instalar-cliente\.ps1$') {
        Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
    }
    if (-not $SemPausa) {
        Write-Host ''
        Read-Host 'Carregue Enter para fechar'
    }
    if ($ok) { exit 0 } else { exit 1 }
}

$logDir = Join-Path $env:ProgramData 'nodehub'
New-Item $logDir -ItemType Directory -Force | Out-Null
Start-Transcript -Path (Join-Path $logDir 'instalacao.log') -Append | Out-Null

try {
    if ($AuthKey -notmatch '^tskey-auth-[A-Za-z0-9-]+$') {
        throw 'Instalador sem chave do Tailscale. Descarregue o instalador no painel do nodehub.'
    }
    $PublicKeys = @($PublicKeys | Where-Object { $_ -match '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+|sk-\S+) ' })
    if (-not $PublicKeys) { throw 'Instalador sem chaves SSH. Descarregue o instalador no painel do nodehub.' }

    # --- 1. Tailscale ----------------------------------------------------------
    $tsExe = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (-not (Test-Path $tsExe)) {
        Passo 'A descarregar e instalar o Tailscale'
        $msi = Join-Path $env:TEMP 'tailscale-setup.msi'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest 'https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi' -OutFile $msi -UseBasicParsing
        $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart TS_UNATTENDEDMODE=always" -Wait -PassThru
        if ($p.ExitCode -notin 0, 3010) { throw "A instalação do Tailscale falhou (código $($p.ExitCode))." }
        Remove-Item $msi -Force
    } else {
        Passo 'Tailscale já instalado'
    }

    # Já ligada à rede do suporte (Running + tag:cliente)? Então não mexer: um novo
    # "tailscale up" mudava-lhe o nome na tailnet e o histórico deixava de bater certo.
    $estado = $null
    try { $estado = (& $tsExe status --json 2>$null | Out-String) | ConvertFrom-Json } catch { }
    $jaLigada = $estado -and $estado.BackendState -eq 'Running' -and (@($estado.Self.Tags) -contains 'tag:cliente')

    if ($jaLigada) {
        $hostname = ($estado.Self.DNSName -split '\.')[0]
        Passo "Já ligada à rede do suporte como '$hostname' (sem alterações)"
    } else {
        $hostname = ($env:COMPUTERNAME.ToLower() -replace '[^a-z0-9-]', '-').Trim('-')
        if ($hostname.Length -gt 63) { $hostname = $hostname.Substring(0, 63) }

        Passo "A ligar à rede do suporte como '$hostname'"
        & $tsExe up --authkey=$AuthKey --unattended --hostname=$hostname --reset
        if ($LASTEXITCODE -ne 0) { throw 'Não foi possível ligar o Tailscale (tailscale up falhou).' }
    }
    $tsIp = (& $tsExe ip -4).Trim()

    # --- 2. Utilizador nodehub -------------------------------------------------
    Passo "A criar o utilizador '$UserName'"
    # Password aleatória que ninguém conhece: o acesso é só por chave SSH
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $pass = ConvertTo-SecureString ([Convert]::ToBase64String($bytes) + 'aA1!') -AsPlainText -Force

    $user = Get-LocalUser -Name $UserName -ErrorAction SilentlyContinue
    if ($user) {
        $user | Set-LocalUser -Password $pass -PasswordNeverExpires $true
        $user | Enable-LocalUser
    } else {
        New-LocalUser -Name $UserName -Password $pass -PasswordNeverExpires -AccountNeverExpires `
            -Description 'nodehub: suporte remoto' | Out-Null
    }
    # Grupo Administradores pelo SID (funciona em Windows PT e EN)
    $admins = Get-LocalGroup -SID 'S-1-5-32-544'
    if (-not (Get-LocalGroupMember -Group $admins | Where-Object { $_.Name -match "\\$UserName$" })) {
        Add-LocalGroupMember -Group $admins -Member $UserName
    }
    # Esconder do ecrã de login
    $ul = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList'
    New-Item $ul -Force | Out-Null
    New-ItemProperty $ul -Name $UserName -Value 0 -PropertyType DWord -Force | Out-Null

    # --- 3. OpenSSH Server -----------------------------------------------------
    Passo 'A instalar o OpenSSH Server'
    $cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
    if ($cap.State -ne 'Installed') {
        try { Add-WindowsCapability -Online -Name $cap.Name | Out-Null }
        catch { throw "Não foi possível instalar o OpenSSH Server pelo Windows Update: $($_.Exception.Message)" }
    }
    Set-Service sshd -StartupType Automatic
    Start-Service sshd   # o primeiro arranque gera as chaves do servidor e o sshd_config

    # Shell por omissão: PowerShell
    New-Item 'HKLM:\SOFTWARE\OpenSSH' -Force | Out-Null
    New-ItemProperty 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell `
        -Value "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force | Out-Null

    # Só autenticação por chave
    $cfg = Join-Path $env:ProgramData 'ssh\sshd_config'
    $content = Get-Content $cfg
    $content = $content -replace '^\s*#?\s*PasswordAuthentication\s+.*$', 'PasswordAuthentication no'
    if (-not ($content -match '^PasswordAuthentication no')) { $content = @('PasswordAuthentication no') + $content }
    Set-Content -Path $cfg -Value $content -Encoding ascii

    # Chaves públicas dos técnicos (acrescenta, não apaga as que já existam)
    $ak = Join-Path $env:ProgramData 'ssh\administrators_authorized_keys'
    $existentes = if (Test-Path $ak) { @(Get-Content $ak) } else { @() }
    # Compara só o tipo + chave (ignora o comentário no fim da linha)
    $corpos = @($existentes | ForEach-Object { ($_ -split '\s+')[0..1] -join ' ' })
    $novas = $PublicKeys | Where-Object { $corpos -notcontains (($_ -split '\s+')[0..1] -join ' ') }
    Set-Content -Path $ak -Value (@($existentes) + @($novas) | Where-Object { $_ }) -Encoding ascii
    icacls $ak /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null

    Restart-Service sshd

    # --- 4. Firewall -----------------------------------------------------------
    Passo 'A configurar a firewall (SSH só pela rede do suporte)'
    Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue | Disable-NetFirewallRule
    Remove-NetFirewallRule -Name 'nodehub-SSH' -ErrorAction SilentlyContinue
    New-NetFirewallRule -Name 'nodehub-SSH' -DisplayName 'nodehub: OpenSSH (só Tailscale)' `
        -Direction Inbound -Protocol TCP -LocalPort 22 -RemoteAddress '100.64.0.0/10' -Action Allow | Out-Null

    # --- Fim -------------------------------------------------------------------
    Write-Host ''
    Write-Host '=============================================' -ForegroundColor Green
    Write-Host '  Instalação concluída' -ForegroundColor Green
    Write-Host '=============================================' -ForegroundColor Green
    Write-Host "  Máquina: $hostname"
    Write-Host "  IP:      $tsIp"
    Write-Host ''
    Write-Host '  A máquina já aparece no painel do técnico.'
    Terminar $true
}
catch {
    Write-Host ''
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Registo em: $logDir\instalacao.log"
    Terminar $false
}
