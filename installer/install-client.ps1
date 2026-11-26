<#
.SYNOPSIS
    Prepares a client PC for nodehub helpdesk.

.DESCRIPTION
    - Installs Tailscale (unattended mode) and joins the tailnet (the auth key applies the client tag)
    - Creates the local user "nodehub" (administrator, hidden from the sign-in screen, no known password)
    - Installs OpenSSH Server, key authentication only
    - Firewall: SSH only from the tailnet (100.64.0.0/10)

    This file is a TEMPLATE. The installer used on client PCs is downloaded from the dashboard
    ("Add machine"), with the Tailscale auth key, the SSH public keys and the team language
    (messages in English or Portuguese) already filled in.
    When it finishes, the installer deletes itself (it contains the Tailscale auth key).

.NOTES
    Run with: right-click > "Run with PowerShell". It asks for elevation by itself.
    Over SSH (already elevated): powershell -ExecutionPolicy Bypass -File nodehub-install.ps1 -NoPause
#>
param(
    [string]   $AuthKey    = '__NODEHUB_AUTHKEY__',
    [string[]] $PublicKeys = @('__NODEHUB_PUBKEYS__'),
    [string]   $ClientTag  = '__NODEHUB_CLIENT_TAG__',
    [string]   $Language   = '__NODEHUB_LANGUAGE__',   # en | pt: language of the messages shown on the PC
    [switch]   $NoPause    # do not wait for Enter at the end (remote/automated runs)
)

$ErrorActionPreference = 'Stop'
$UserName = 'nodehub'

# --- Messages (the client sees these) ---------------------------------------------
$Messages = @{
    en = @{
        NoAuthKey    = 'Installer has no Tailscale auth key. Download the installer from the nodehub dashboard.'
        NoKeys       = 'Installer has no SSH keys. Download the installer from the nodehub dashboard.'
        Downloading  = 'Downloading and installing Tailscale'
        BadSignature = 'The downloaded Tailscale installer is not validly signed by Tailscale Inc. ({0}). Nothing was installed.'
        TsFailed     = 'Tailscale installation failed (exit code {0}).'
        TsInstalled  = 'Tailscale already installed'
        Joined       = "Already on the support network as '{0}' (no changes)"
        Joining      = "Joining the support network as '{0}'"
        TsUpFailed   = 'Could not connect Tailscale (tailscale up failed).'
        CreatingUser = "Creating user '{0}'"
        UserDesc     = 'nodehub: remote support'
        OpenSsh      = 'Installing OpenSSH Server'
        OpenSshFail  = 'Could not install OpenSSH Server through Windows Update: {0}'
        Firewall     = 'Configuring the firewall (SSH only from the support network)'
        Complete     = 'Installation complete'
        Machine      = 'Machine'
        Shows        = "The machine now shows up in the technician's dashboard."
        Error        = 'ERROR'
        Log          = 'Log'
        PressEnter   = 'Press Enter to close'
    }
    pt = @{
        NoAuthKey    = 'O instalador não tem a chave do Tailscale. Descarregue o instalador a partir do dashboard do nodehub.'
        NoKeys       = 'O instalador não tem chaves SSH. Descarregue o instalador a partir do dashboard do nodehub.'
        Downloading  = 'A descarregar e instalar o Tailscale'
        BadSignature = 'O instalador do Tailscale descarregado não tem uma assinatura válida da Tailscale Inc. ({0}). Não foi instalado nada.'
        TsFailed     = 'A instalação do Tailscale falhou (código {0}).'
        TsInstalled  = 'O Tailscale já está instalado'
        Joined       = "Já está na rede de suporte como '{0}' (sem alterações)"
        Joining      = "A entrar na rede de suporte como '{0}'"
        TsUpFailed   = 'Não foi possível ligar o Tailscale (tailscale up falhou).'
        CreatingUser = "A criar o utilizador '{0}'"
        UserDesc     = 'nodehub: suporte remoto'
        OpenSsh      = 'A instalar o OpenSSH Server'
        OpenSshFail  = 'Não foi possível instalar o OpenSSH Server pelo Windows Update: {0}'
        Firewall     = 'A configurar a firewall (SSH só a partir da rede de suporte)'
        Complete     = 'Instalação concluída'
        Machine      = 'Máquina'
        Shows        = 'A máquina já aparece no dashboard do técnico.'
        Error        = 'ERRO'
        Log          = 'Registo'
        PressEnter   = 'Carregue em Enter para fechar'
    }
}
$T = if ($Messages.ContainsKey($Language)) { $Messages[$Language] } else { $Messages['en'] }

# --- 0. Elevation --------------------------------------------------------------
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Finish($ok) {
    try { Stop-Transcript | Out-Null } catch { }
    # The installer contains the Tailscale auth key: do not leave it on the machine
    if ($PSCommandPath -and (Test-Path $PSCommandPath) -and $PSCommandPath -notmatch '\\installer\\install-client\.ps1$') {
        Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
    }
    if (-not $NoPause) {
        Write-Host ''
        Read-Host $T.PressEnter
    }
    if ($ok) { exit 0 } else { exit 1 }
}

$logDir = Join-Path $env:ProgramData 'nodehub'
New-Item $logDir -ItemType Directory -Force | Out-Null
Start-Transcript -Path (Join-Path $logDir 'install.log') -Append | Out-Null

try {
    if ($AuthKey -notmatch '^tskey-auth-[A-Za-z0-9-]+$') {
        throw $T.NoAuthKey
    }
    $PublicKeys = @($PublicKeys | Where-Object { $_ -match '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+|sk-\S+) ' })
    if (-not $PublicKeys) { throw $T.NoKeys }

    # --- 1. Tailscale ----------------------------------------------------------
    $tsExe = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (-not (Test-Path $tsExe)) {
        Step $T.Downloading
        $msi = Join-Path $env:TEMP 'tailscale-setup.msi'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest 'https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi' -OutFile $msi -UseBasicParsing
        # Only install it if Windows confirms it is signed by Tailscale and unmodified
        $signature = Get-AuthenticodeSignature $msi
        if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|, )O=Tailscale Inc\.(,|$)') {
            Remove-Item $msi -Force -ErrorAction SilentlyContinue
            throw ($T.BadSignature -f $signature.Status)
        }
        $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart TS_UNATTENDEDMODE=always" -Wait -PassThru
        if ($p.ExitCode -notin 0, 3010) { throw ($T.TsFailed -f $p.ExitCode) }
        Remove-Item $msi -Force
    } else {
        Step $T.TsInstalled
    }

    # Already on the support tailnet (Running + client tag)? Then leave it alone: another
    # "tailscale up" would rename it in the tailnet and its history would no longer match.
    $status = $null
    try { $status = (& $tsExe status --json 2>$null | Out-String) | ConvertFrom-Json } catch { }
    $alreadyJoined = $status -and $status.BackendState -eq 'Running' -and (@($status.Self.Tags) -contains $ClientTag)

    if ($alreadyJoined) {
        $hostname = ($status.Self.DNSName -split '\.')[0]
        Step ($T.Joined -f $hostname)
    } else {
        $hostname = ($env:COMPUTERNAME.ToLower() -replace '[^a-z0-9-]', '-').Trim('-')
        if ($hostname.Length -gt 63) { $hostname = $hostname.Substring(0, 63) }

        Step ($T.Joining -f $hostname)
        & $tsExe up --authkey=$AuthKey --unattended --hostname=$hostname --reset
        if ($LASTEXITCODE -ne 0) { throw $T.TsUpFailed }
    }
    $tsIp = (& $tsExe ip -4).Trim()

    # --- 2. nodehub user -------------------------------------------------------
    Step ($T.CreatingUser -f $UserName)
    # Random password nobody knows: access is SSH key only
    $bytes = New-Object byte[] 24
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $pass = ConvertTo-SecureString ([Convert]::ToBase64String($bytes) + 'aA1!') -AsPlainText -Force

    $user = Get-LocalUser -Name $UserName -ErrorAction SilentlyContinue
    if ($user) {
        $user | Set-LocalUser -Password $pass -PasswordNeverExpires $true
        $user | Enable-LocalUser
    } else {
        New-LocalUser -Name $UserName -Password $pass -PasswordNeverExpires -AccountNeverExpires `
            -Description $T.UserDesc | Out-Null
    }
    # Administrators group by SID (works on any Windows language)
    $admins = Get-LocalGroup -SID 'S-1-5-32-544'
    if (-not (Get-LocalGroupMember -Group $admins | Where-Object { $_.Name -match "\\$UserName$" })) {
        Add-LocalGroupMember -Group $admins -Member $UserName
    }
    # Hide from the sign-in screen
    $ul = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList'
    New-Item $ul -Force | Out-Null
    New-ItemProperty $ul -Name $UserName -Value 0 -PropertyType DWord -Force | Out-Null

    # --- 3. OpenSSH Server -----------------------------------------------------
    Step $T.OpenSsh
    $cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
    if ($cap.State -ne 'Installed') {
        try { Add-WindowsCapability -Online -Name $cap.Name | Out-Null }
        catch { throw ($T.OpenSshFail -f $_.Exception.Message) }
    }
    Set-Service sshd -StartupType Automatic
    Start-Service sshd   # first start generates the host keys and sshd_config

    # Default shell: PowerShell
    New-Item 'HKLM:\SOFTWARE\OpenSSH' -Force | Out-Null
    New-ItemProperty 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell `
        -Value "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force | Out-Null

    # Key authentication only
    $cfg = Join-Path $env:ProgramData 'ssh\sshd_config'
    $content = Get-Content $cfg
    $content = $content -replace '^\s*#?\s*PasswordAuthentication\s+.*$', 'PasswordAuthentication no'
    if (-not ($content -match '^PasswordAuthentication no')) { $content = @('PasswordAuthentication no') + $content }
    Set-Content -Path $cfg -Value $content -Encoding ascii

    # Technicians' public keys (appended; existing keys are kept)
    $ak = Join-Path $env:ProgramData 'ssh\administrators_authorized_keys'
    $existing = if (Test-Path $ak) { @(Get-Content $ak) } else { @() }
    # Compare type + key only (ignore the trailing comment)
    $bodies = @($existing | ForEach-Object { ($_ -split '\s+')[0..1] -join ' ' })
    $new = $PublicKeys | Where-Object { $bodies -notcontains (($_ -split '\s+')[0..1] -join ' ') }
    Set-Content -Path $ak -Value (@($existing) + @($new) | Where-Object { $_ }) -Encoding ascii
    icacls $ak /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null

    Restart-Service sshd

    # --- 4. Firewall -----------------------------------------------------------
    Step $T.Firewall
    Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue | Disable-NetFirewallRule
    Remove-NetFirewallRule -Name 'nodehub-SSH' -ErrorAction SilentlyContinue
    New-NetFirewallRule -Name 'nodehub-SSH' -DisplayName 'nodehub: OpenSSH (Tailscale only)' `
        -Direction Inbound -Protocol TCP -LocalPort 22 -RemoteAddress '100.64.0.0/10' -Action Allow | Out-Null

    # --- Done ------------------------------------------------------------------
    Write-Host ''
    Write-Host '=============================================' -ForegroundColor Green
    Write-Host "  $($T.Complete)" -ForegroundColor Green
    Write-Host '=============================================' -ForegroundColor Green
    Write-Host "  $($T.Machine): $hostname"
    Write-Host "  IP:      $tsIp"
    Write-Host ''
    Write-Host "  $($T.Shows)"
    Finish $true
}
catch {
    Write-Host ''
    Write-Host "$($T.Error): $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "$($T.Log): $logDir\install.log"
    Finish $false
}
