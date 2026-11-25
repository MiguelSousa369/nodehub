<#
.SYNOPSIS
    Registers the nodehub:// protocol for the current user (no admin needed).

.EXAMPLE
    .\register-protocol.ps1            # register
    .\register-protocol.ps1 -Remove    # remove
#>
param([switch]$Remove)

$key = 'HKCU:\Software\Classes\nodehub'

if ($Remove) {
    Remove-Item $key -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host 'nodehub:// protocol removed.'
    return
}

$script  = Join-Path $PSScriptRoot 'open.ps1'
$command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" `"%1`""

New-Item "$key\shell\open\command" -Force | Out-Null
Set-ItemProperty $key -Name '(Default)' -Value 'URL:nodehub'
Set-ItemProperty $key -Name 'URL Protocol' -Value ''
Set-ItemProperty "$key\shell\open\command" -Name '(Default)' -Value $command

Write-Host 'nodehub:// protocol registered.'
Write-Host "Test: Start-Process 'nodehub://open?host=<machine>'"
