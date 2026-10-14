@echo off
rem Lanceur un clic de Kayro (raccourci Bureau). Voir Kayro.ps1.
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Kayro.ps1" %*
