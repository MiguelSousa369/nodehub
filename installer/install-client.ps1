<#
.SYNOPSIS
    Prepares a client PC for nodehub helpdesk.

.DESCRIPTION
    - Installs Tailscale (unattended mode) and joins the tailnet with tag:cliente
    - Creates the local user "nodehub" (administrator, hidden from the sign-in screen, no known password)
    - Installs OpenSSH Server, key authentication only
    - Firewall: SSH only from the tailnet (100.64.0.0/10)

    This file is a TEMPLATE. The installer used on client PCs is downloaded from the dashboard
    ("Add machine"), with the Tailscale auth key and the SSH public keys already filled in.
    When it finishes, the installer deletes itself (it contains the Tailscale auth key).

.NOTES
    Run with: right-click > "Run with PowerShell". It asks for elevation by itself.
    Over SSH (already elevated): powershell -ExecutionPolicy Bypass -File nodehub-install.ps1 -NoPause
#>
param(
    [string]   $AuthKey    = '__NODEHUB_AUTHKEY__',
    [string[]] $PublicKeys = @('__NODEHUB_PUBKEYS__'),
    [switch]   $NoPause    # do not wait for Enter at the end (remote/automated runs)
)

$ErrorActionPreference = 'Stop'
$UserName = 'nodehub'

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
        Read-Host 'Press Enter to close'
    }
    if ($ok) { exit 0 } else { exit 1 }
}

$logDir = Join-Path $env:ProgramData 'nodehub'
New-Item $logDir -ItemType Directory -Force | Out-Null
Start-Transcript -Path (Join-Path $logDir 'install.log') -Append | Out-Null

try {
    if ($AuthKey -notmatch '^tskey-auth-[A-Za-z0-9-]+$') {
        throw 'Installer has no Tailscale auth key. Download the installer from the nodehub dashboard.'
    }
    $PublicKeys = @($PublicKeys | Where-Object { $_ -match '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-\S+|sk-\S+) ' })
    if (-not $PublicKeys) { throw 'Installer has no SSH keys. Download the installer from the nodehub dashboard.' }

    # --- 1. Tailscale ----------------------------------------------------------
    $tsExe = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (-not (Test-Path $tsExe)) {
        Step 'Downloading and installing Tailscale'
        $msi = Join-Path $env:TEMP 'tailscale-setup.msi'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest 'https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi' -OutFile $msi -UseBasicParsing
        $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart TS_UNATTENDEDMODE=always" -Wait -PassThru
        if ($p.ExitCode -notin 0, 3010) { throw "Tailscale installation failed (exit code $($p.ExitCode))." }
        Remove-Item $msi -Force
    } else {
        Step 'Tailscale already installed'
    }

    # Already on the support tailnet (Running + tag:cliente)? Then leave it alone: another
    # "tailscale up" would rename it in the tailnet and its history would no longer match.
    $status = $null
    try { $status = (& $tsExe status --json 2>$null | Out-String) | ConvertFrom-Json } catch { }
    $alreadyJoined = $status -and $status.BackendState -eq 'Running' -and (@($status.Self.Tags) -contains 'tag:cliente')

    if ($alreadyJoined) {
        $hostname = ($status.Self.DNSName -split '\.')[0]
        Step "Already on the support network as '$hostname' (no changes)"
    } else {
        $hostname = ($env:COMPUTERNAME.ToLower() -replace '[^a-z0-9-]', '-').Trim('-')
        if ($hostname.Length -gt 63) { $hostname = $hostname.Substring(0, 63) }

        Step "Joining the support network as '$hostname'"
        & $tsExe up --authkey=$AuthKey --unattended --hostname=$hostname --reset
        if ($LASTEXITCODE -ne 0) { throw 'Could not connect Tailscale (tailscale up failed).' }
    }
    $tsIp = (& $tsExe ip -4).Trim()

    # --- 2. nodehub user -------------------------------------------------------
    Step "Creating user '$UserName'"
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
            -Description 'nodehub: remote support' | Out-Null
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
    Step 'Installing OpenSSH Server'
    $cap = Get-WindowsCapability -Online -Name 'OpenSSH.Server*'
    if ($cap.State -ne 'Installed') {
        try { Add-WindowsCapability -Online -Name $cap.Name | Out-Null }
        catch { throw "Could not install OpenSSH Server through Windows Update: $($_.Exception.Message)" }
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
    Step 'Configuring the firewall (SSH only from the support network)'
    Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue | Disable-NetFirewallRule
    Remove-NetFirewallRule -Name 'nodehub-SSH' -ErrorAction SilentlyContinue
    New-NetFirewallRule -Name 'nodehub-SSH' -DisplayName 'nodehub: OpenSSH (Tailscale only)' `
        -Direction Inbound -Protocol TCP -LocalPort 22 -RemoteAddress '100.64.0.0/10' -Action Allow | Out-Null

    # --- Done ------------------------------------------------------------------
    Write-Host ''
    Write-Host '=============================================' -ForegroundColor Green
    Write-Host '  Installation complete' -ForegroundColor Green
    Write-Host '=============================================' -ForegroundColor Green
    Write-Host "  Machine: $hostname"
    Write-Host "  IP:      $tsIp"
    Write-Host ''
    Write-Host "  The machine now shows up in the technician's dashboard."
    Finish $true
}
catch {
    Write-Host ''
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Log: $logDir\install.log"
    Finish $false
}
