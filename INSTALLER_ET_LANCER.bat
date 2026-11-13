<# : TalentWave Live - installation et lancement complets (un seul fichier : partie cmd puis partie PowerShell)
@echo off
rem PATH systeme garanti (certains PC n'ont pas System32 dans PATH : chcp, cmd, powershell introuvables)
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\WindowsPowerShell\v1.0;%ProgramFiles%\nodejs;%PATH%"
"%SystemRoot%\System32\chcp.com" 65001 >nul
title TalentWave Live - installation et lancement de A a Z
set "TW_ROOT=%~dp0"
set "TW_ARGS=%*"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText('%~f0', [Text.Encoding]::UTF8))"
echo.
pause
exit /b
#>
# ============================================================================================================
#  Double-clic : fait TOUT, de A a Z, sur un PC Windows 10/11 neuf.
#   1. Node.js 20+, MongoDB, Ollama : verifies, installes avec winget s'ils manquent, demarres
#   2. Fichier .env : garde celui fourni, sinon le cree (secrets JWT aleatoires + votre Gmail pour les VRAIS e-mails)
#   3. Dependances npm, puis TELECHARGEMENT des modeles IA reels : Whisper small, MiniLM multilingue, Llama 3.1 8B
#   4. Interface compilee, puis les DONNEES REELLES du projet (models/donnees/talentwave_live.json : comptes, offres,
#      quiz, passages, candidatures avec CV, entretiens avec transcriptions et notes) ; a defaut, donnees de demonstration
#   5. Tests unitaires + collection Postman complete (Newman, instance isolee, e-mails reellement envoyes) -> rapport-postman.pdf
#   6. Lancement de l'application sur http://localhost:8200 et ouverture du navigateur
#   7. Collection Postman CRUD sur l'application lancee : Quiz, Entretiens, Chatbot, Processus d'entretien
#  Options : --sans-tests (saute les etapes 5 et 7)   --reinitialiser (remplace la base par les donnees du projet)
# ============================================================================================================
$ErrorActionPreference = 'Stop'
$Root = $env:TW_ROOT.TrimEnd('\')
Set-Location $Root
$Args2 = "$env:TW_ARGS"
$SkipTests = $Args2 -match '--sans-tests'
$Reset = $Args2 -match '--reinitialiser'
$Port = 8200
$App = "http://localhost:$Port"
$script:n = 0
$started = Get-Date
$logFile = Join-Path $Root 'installation.log'
"=== Installation TalentWave Live $(Get-Date -Format s) ===" | Out-File $logFile -Encoding utf8

function Step($t) { $script:n++; Write-Host ""; Write-Host "$($script:n). $t" -ForegroundColor Cyan; "`n$($script:n). $t" | Out-File $logFile -Append -Encoding utf8 }
function Ok($t) { Write-Host "   [OK] $t" -ForegroundColor Green; "   OK $t" | Out-File $logFile -Append -Encoding utf8 }
function Warn($t) { Write-Host "   [!] $t" -ForegroundColor Yellow; "   ! $t" | Out-File $logFile -Append -Encoding utf8 }
function Fail($t) {
  Write-Host "   [X] $t" -ForegroundColor Red; "   X $t" | Out-File $logFile -Append -Encoding utf8
  Write-Host "`nInstallation interrompue. Journal : $logFile" -ForegroundColor Red
  exit 1
}
function RefreshPath {
  $sys = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
  $env:Path = $sys + ';' + [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  foreach ($p in @("$env:ProgramFiles\nodejs", "$env:LOCALAPPDATA\Programs\Ollama")) { if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) { $env:Path += ";$p" } }
}
function PortOpen($port) {
  $c = New-Object Net.Sockets.TcpClient
  try { $c.ConnectAsync('127.0.0.1', $port).Wait(800) -and $c.Connected } catch { $false } finally { $c.Dispose() }
}
function WaitPort($port, $seconds) { for ($i = 0; $i -lt $seconds; $i++) { if (PortOpen $port) { return $true }; Start-Sleep 1 }; return $false }
function WingetInstall($id, $label) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Fail "$label manquant et winget indisponible : installez $label manuellement puis relancez." }
  Warn "$label absent : installation avec winget ($id), acceptez la fenetre d'autorisation Windows si elle apparait..."
  winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements 2>&1 | ForEach-Object { Add-Content -Path $logFile -Value $_ -Encoding utf8; $_ } | Out-Null
  RefreshPath
}
# Lance une commande, journalise tout, echoue proprement si le code de sortie n'est pas 0.
function Run($label, $file, [string[]]$arguments, [switch]$Soft) {
  $ErrorActionPreference = 'Continue' # stderr d'npm / node n'est pas une erreur ; seul le code de sortie compte
  & $file @arguments 2>&1 | ForEach-Object { "$_" } | ForEach-Object { Add-Content -Path $logFile -Value $_ -Encoding utf8; $_ } | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
  if ($LASTEXITCODE -ne 0) { if ($Soft) { Warn "$label : code $LASTEXITCODE (voir $logFile)"; return $false } else { Fail "$label a echoue (code $LASTEXITCODE). Journal : $logFile" } }
  return $true
}
function EnvValue($key) {
  if (-not (Test-Path "$Root\.env")) { return '' }
  $line = Get-Content "$Root\.env" -Encoding utf8 | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
  if ($line) { return ($line -replace "^\s*$key\s*=\s*", '').Trim() } else { return '' }
}
function NewSecret { $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b).TrimEnd('=').Replace('+', '-').Replace('/', '_') }

Write-Host "TalentWave Live - installation et lancement complets" -ForegroundColor White
Write-Host "Dossier : $Root   (journal detaille : installation.log)" -ForegroundColor DarkGray
RefreshPath

# ------------------------------------------------------------------------------------------------------------
Step 'Node.js 20 ou plus'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { WingetInstall 'OpenJS.NodeJS.LTS' 'Node.js' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js introuvable apres installation : fermez cette fenetre et relancez le fichier.' }
$nodeMajor = [int]((node -v).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { Fail "Node.js $(node -v) trop ancien : version 20 ou plus requise (https://nodejs.org)." }
Ok "Node.js $(node -v), npm $(npm -v)"

# ------------------------------------------------------------------------------------------------------------
Step 'MongoDB (port 27017)'
if (-not (PortOpen 27017)) {
  $svc = Get-Service -Name 'MongoDB*' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $svc) { WingetInstall 'MongoDB.Server' 'MongoDB'; $svc = Get-Service -Name 'MongoDB*' -ErrorAction SilentlyContinue | Select-Object -First 1 }
  if ($svc -and $svc.Status -ne 'Running') {
    try { Start-Service $svc.Name } catch { Start-Process powershell -Verb RunAs -Wait -ArgumentList "-NoProfile -Command Start-Service '$($svc.Name)'" }
  }
  if (-not (WaitPort 27017 30)) { Fail 'MongoDB ne repond pas sur le port 27017 : demarrez le service Windows "MongoDB" puis relancez.' }
}
Ok 'MongoDB repond sur 127.0.0.1:27017'

# ------------------------------------------------------------------------------------------------------------
Step 'Ollama (modele de langage local Llama 3.1)'
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { WingetInstall 'Ollama.Ollama' 'Ollama' }
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { Fail 'Ollama introuvable apres installation : installez-le depuis https://ollama.com puis relancez.' }
if (-not (PortOpen 11434)) { Start-Process ollama -ArgumentList 'serve' -WindowStyle Hidden; if (-not (WaitPort 11434 30)) { Fail 'Ollama ne demarre pas (port 11434).' } }
Ok "Ollama $((ollama --version 2>&1 | Select-Object -Last 1) -replace '.*version is ', '') sur le port 11434"

# ------------------------------------------------------------------------------------------------------------
Step 'Configuration (.env)'
if (Test-Path "$Root\.env") {
  Ok '.env fourni : conserve tel quel'
} else {
  Copy-Item "$Root\.env.example" "$Root\.env"
  $content = Get-Content "$Root\.env" -Raw -Encoding utf8
  $content = $content -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$(NewSecret)" -replace '(?m)^JWT_REFRESH_SECRET=.*$', "JWT_REFRESH_SECRET=$(NewSecret)"
  $content = $content -replace '(?m)^FRONTEND_URL=.*$', "FRONTEND_URL=$App"
  Write-Host '   Les e-mails (acceptation, quiz, entretien, decision) sont REELLEMENT envoyes avec un compte Gmail.' -ForegroundColor White
  Write-Host '   Mot de passe d application Gmail : https://myaccount.google.com/apppasswords (validation en 2 etapes requise).' -ForegroundColor DarkGray
  $gmail = Read-Host '   Adresse Gmail d envoi'
  $pass = Read-Host '   Mot de passe d application (16 lettres)'
  if ($gmail -and $pass) {
    $content = $content -replace '(?m)^SMTP_USER=.*$', "SMTP_USER=$gmail" -replace '(?m)^MAIL_FROM=.*$', "MAIL_FROM=$gmail" -replace '(?m)^SMTP_PASSWORD=.*$', "SMTP_PASSWORD=$($pass -replace '\s', '')"
  } else { Warn 'Gmail non renseigne : l application fonctionne mais les e-mails ne partiront pas (completez SMTP_* dans .env).' }
  [IO.File]::WriteAllText("$Root\.env", $content, (New-Object Text.UTF8Encoding $false))
  Ok '.env cree (secrets JWT aleatoires)'
}
# L application compilee est servie sur 8200 : les liens des e-mails doivent y pointer.
$env:FRONTEND_URL = $App
if ((EnvValue 'SMTP_PASSWORD') -match 'mot_de_passe_application') { Warn 'SMTP_PASSWORD non renseigne dans .env : les e-mails ne partiront pas.' } else { Ok "E-mails reels via $(EnvValue 'SMTP_HOST') ($(EnvValue 'SMTP_USER'))" }
if (EnvValue 'GOOGLE_REFRESH_TOKEN') { Ok 'Google Meet configure : vrais liens Meet + invitations Google Agenda' } else { Warn 'Google non configure : salle de visio Jitsi Meet (reelle, sans compte). Pour Google Meet : npm run google:auth' }

# ------------------------------------------------------------------------------------------------------------
Step 'Dependances npm'
$lock = Get-Item "$Root\package-lock.json"
$stamp = "$Root\node_modules\.package-lock.json"
if ((Test-Path $stamp) -and ((Get-Item $stamp).LastWriteTime -ge $lock.LastWriteTime)) { Ok 'deja installees' }
else { Run 'npm ci' 'npm.cmd' @('ci', '--no-audit', '--no-fund') | Out-Null; Ok 'installees (npm ci)' }

# ------------------------------------------------------------------------------------------------------------
Step 'Modeles IA reels (telechargement automatique, une seule fois : ~370 Mo + 4,9 Go pour Llama 3.1)'
Run 'Telechargement des modeles' 'npm.cmd' @('run', 'models') | Out-Null
$models = ollama list 2>&1 | Out-String
$llm = EnvValue 'OLLAMA_MODEL'; if (-not $llm) { $llm = 'llama3.1:8b' }
if ($models -notmatch [regex]::Escape($llm.Split(':')[0])) { Run "ollama pull $llm" 'ollama' @('pull', $llm) | Out-Null }
Ok "Whisper small (transcription fr/en), MiniLM multilingue (similarite), $llm (juge, questions, chatbot)"

# ------------------------------------------------------------------------------------------------------------
Step 'Interface compilee (React -> public/)'
Run 'npm run build' 'npm.cmd' @('run', 'build') | Out-Null
Ok 'public/ a jour'

# ------------------------------------------------------------------------------------------------------------
Step 'Base de donnees (donnees reelles du projet)'
if (Test-Path "$Root\models\donnees\talentwave_live.json") {
  $importArgs = @('models/donnees.js', 'import'); if ($Reset) { $importArgs += '--force' }
  Run 'Import des donnees' 'node' $importArgs | Out-Null
  Ok 'donnees du projet chargees (une base existante n est jamais ecrasee sans --reinitialiser)'
} else {
  if ($Reset) { Run 'seed' 'npm.cmd' @('run', 'seed', '--', '--force') | Out-Null } else { Run 'seed' 'npm.cmd' @('run', 'seed') | Out-Null }
  Ok 'donnees de demonstration : comptes, 7 offres, 6 quiz, entretiens evalues'
}

# ------------------------------------------------------------------------------------------------------------
if ($SkipTests) {
  Step 'Tests'; Warn 'sautes (--sans-tests)'
} else {
  Step 'Tests unitaires'
  if (Run 'npm test' 'npm.cmd' @('test') -Soft) { Ok 'tests unitaires reussis (architecture MVC, IA, audio, notation)' }
  Step 'Tests Postman complets (Newman, instance isolee port 8201, e-mails reellement envoyes) -> rapport-postman.pdf'
  if (Run 'Collection Postman' 'node' @('routes/tests/postman/run-postman.js') -Soft) { Ok 'tous les tests Postman reussis' }
  if (Test-Path "$Root\rapport-postman.pdf") { Ok "rapport : $Root\rapport-postman.pdf" }
}

# ------------------------------------------------------------------------------------------------------------
Step "Lancement de l application ($App)"
if (PortOpen $Port) {
  Warn "le port $Port est deja utilise (application deja lancee ?) : ouverture du navigateur"
} else {
  # Fenetre visible du serveur ; sa sortie est AUSSI ecrite dans serveur-app.log (diagnostic si le demarrage echoue).
  # FRONTEND_URL et MONGODB_URI eventuels sont herites de ce processus.
  $serverLog = Join-Path $Root 'serveur-app.log'
  Remove-Item $serverLog -ErrorAction SilentlyContinue
  $cmdServer = "[Console]::OutputEncoding = [Text.Encoding]::UTF8; `$host.UI.RawUI.WindowTitle = 'TalentWave Live - serveur (fermez cette fenetre pour arreter)'; `$ErrorActionPreference = 'Continue'; Set-Location '$Root'; npm.cmd start 2>&1 | ForEach-Object { `$l = ""`$_""; Write-Host `$l; Add-Content -Path '$serverLog' -Value `$l -Encoding utf8 }"
  Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList '-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $cmdServer
  if (-not (WaitPort $Port 120)) {
    $tail = if (Test-Path $serverLog) { (Get-Content $serverLog -Tail 15 -Encoding utf8) -join "`n     " } else { '(aucune sortie du serveur)' }
    Fail "le serveur ne repond pas sur le port $Port apres 2 minutes. Dernieres lignes du serveur :`n     $tail"
  }
}
Start-Sleep 2
Start-Process $App
Ok "Application : $App      Swagger : $App/api-docs"

# ------------------------------------------------------------------------------------------------------------
if (-not $SkipTests) {
  Step 'Collection Postman CRUD sur l application lancee (Quiz, Entretiens, Chatbot, Processus d entretien)'
  New-Item -ItemType Directory -Force "$Root\routes\tests\postman\rapports" | Out-Null
  Run 'Generation de la collection CRUD' 'node' @('routes/tests/postman/build-crud.js') | Out-Null
  $crudOk = Run 'Collection CRUD' 'node' @('node_modules/newman/bin/newman.js', 'run', 'routes/tests/postman/TalentWave-Live-CRUD.postman_collection.json', '--timeout-request', '180000', '--disable-unicode', '-r', 'cli,json', '--reporter-json-export', 'routes/tests/postman/rapports/newman-crud.json') -Soft
  if ($crudOk) { Ok 'CRUD, recherche, filtres, tri, pagination, statistiques, chatbot et entretien complet : tous les tests reussis' }
}

$minutes = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
Write-Host ""
Write-Host "Termine en $minutes min. Comptes de demonstration :" -ForegroundColor Green
Write-Host '   Admin      raifguizani10+live-admin@gmail.com       Admin@2026'
Write-Host '   Recruteur  raifguizani10+live-rh@gmail.com          Recruteur@2026'
Write-Host '   Candidat   raifguizani10+live-candidat3@gmail.com   Candidat@2026   (n a pas encore postule : parcours complet)'
Write-Host ''
Write-Host 'Application Postman : Import > routes\tests\postman\TalentWave-Live-CRUD.postman_collection.json' -ForegroundColor White
Write-Host '   environnement "No Environment" (rien a configurer), application lancee sur le port 8200, puis Run collection.'
Write-Host '   Chaque requete contient sa reponse reelle en exemple (onglet Examples).'
$redirect = EnvValue 'MAIL_REDIRECT_TO'
if ($redirect) { Write-Host "E-mails : tous envoyes a $redirect (le sujet indique le destinataire prevu)." -ForegroundColor White }
Write-Host 'Entretien video (micro + camera) : ouvrez l application dans Chrome ou Edge.'
