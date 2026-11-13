@echo off
rem PATH systeme garanti (certains PC n'ont pas System32 dans PATH : chcp, cmd, powershell introuvables)
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\WindowsPowerShell\v1.0;%ProgramFiles%\nodejs;%PATH%"
"%SystemRoot%\System32\chcp.com" 65001 >nul
title TalentWave Live - serveur de test pour l application Postman
rem Prepare la base de test et demarre le serveur sur le port 8201 pour lancer la collection depuis l application Postman.
rem Importer routes	ests\postman\TalentWave-Live.postman_collection.json et TalentWave-Live-test.postman_environment.json.
rem Laissez cette fenetre ouverte pendant les tests (Ctrl+C pour arreter).
cd /d "%~dp0"
node routes/tests/postman/run-postman.js --serveur %*
echo.
pause
