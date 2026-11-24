<#
.SYNOPSIS
    Regista o protocolo nodehub:// para o utilizador atual (não precisa de admin).

.EXAMPLE
    .\instalar-protocolo.ps1            # regista
    .\instalar-protocolo.ps1 -Remover   # remove
#>
param([switch]$Remover)

$chave = 'HKCU:\Software\Classes\nodehub'

if ($Remover) {
    Remove-Item $chave -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host 'Protocolo nodehub:// removido.'
    return
}

$script = Join-Path $PSScriptRoot 'abrir.ps1'
$comando = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`" `"%1`""

New-Item "$chave\shell\open\command" -Force | Out-Null
Set-ItemProperty $chave -Name '(Default)' -Value 'URL:nodehub'
Set-ItemProperty $chave -Name 'URL Protocol' -Value ''
Set-ItemProperty "$chave\shell\open\command" -Name '(Default)' -Value $comando

Write-Host 'Protocolo nodehub:// registado.'
Write-Host "Teste: Start-Process 'nodehub://open?host=<maquina>'"
