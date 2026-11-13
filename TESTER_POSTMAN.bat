@echo off
rem PATH systeme garanti (certains PC n'ont pas System32 dans PATH : chcp, cmd, powershell introuvables)
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\WindowsPowerShell\v1.0;%ProgramFiles%\nodejs;%PATH%"
"%SystemRoot%\System32\chcp.com" 65001 >nul
title TalentWave Live - tests Postman complets
rem Double-clic : lance TOUTE la collection Postman (Newman) sur une instance de test isolee (port 8201,
rem base talentwave_live_postman, e-mails reellement envoyes) puis ecrit rapport-postman.pdf a la racine.
rem Options : --sans-ia  --emails-captures  --garder
cd /d "%~dp0"
node routes/tests/postman/run-postman.js --ouvrir %*
echo.
pause
