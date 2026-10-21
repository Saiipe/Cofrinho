# Builds a signed, installable universal APK at release/Cofrinho-<version>.apk
# Usage: npm run apk      (or: powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Toolchain: JDK 21 and the Android SDK (defaults to the locations used when this project was set up).
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Join-Path $env:USERPROFILE '.jdks\temurin-21' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { throw "JDK 21 not found at $env:JAVA_HOME (set JAVA_HOME)." }
if (-not (Test-Path (Join-Path $env:ANDROID_HOME 'platforms'))) { throw "Android SDK not found at $env:ANDROID_HOME (set ANDROID_HOME)." }
$env:PATH = "$(Join-Path $env:JAVA_HOME 'bin');$env:PATH"

# Signing key: created once; back up android/keystore and android/keystore.properties —
# without them future versions cannot be installed over this one.
$props = Join-Path $root 'android\keystore.properties'
if (-not (Test-Path $props)) {
  Write-Host 'Creating release keystore (back it up!)' -ForegroundColor Yellow
  New-Item -ItemType Directory -Force (Join-Path $root 'android\keystore') | Out-Null
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $password = [Convert]::ToBase64String($bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')
  & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -keystore (Join-Path $root 'android\keystore\cofrinho-release.jks') -storetype PKCS12 `
    -alias cofrinho -keyalg RSA -keysize 4096 -validity 36500 -storepass $password -keypass $password `
    -dname 'CN=Cofrinho, OU=Software-Finance, O=Software-Finance, C=BR'
  if ($LASTEXITCODE -ne 0) { throw 'keytool failed' }
  "storeFile=keystore/cofrinho-release.jks`nstorePassword=$password`nkeyAlias=cofrinho`nkeyPassword=$password" | Set-Content $props -Encoding ascii
}

Write-Host '1/4 Testing and building web app' -ForegroundColor Cyan
# Tests include the changelog check: a new version cannot ship without its release notes.
npm test
if ($LASTEXITCODE -ne 0) { throw 'tests failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'web build failed' }

Write-Host '2/4 Syncing Capacitor' -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }
# Forward slashes need no escaping in .properties files and work on Windows.
"sdk.dir=$($env:ANDROID_HOME.Replace('\', '/'))" | Set-Content (Join-Path $root 'android\local.properties') -Encoding ascii

Write-Host '3/4 Gradle assembleRelease' -ForegroundColor Cyan
Push-Location (Join-Path $root 'android')
try {
  .\gradlew.bat assembleRelease --no-daemon --console=plain
  if ($LASTEXITCODE -ne 0) { throw 'gradle build failed' }
} finally {
  Pop-Location
}

Write-Host '4/4 Verifying signature' -ForegroundColor Cyan
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$out = Join-Path $root 'release'
New-Item -ItemType Directory -Force $out | Out-Null
$apk = Join-Path $out "Cofrinho-$version.apk"
Copy-Item (Join-Path $root 'android\app\build\outputs\apk\release\app-release.apk') $apk -Force
$buildTools = Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') | Sort-Object Name -Descending | Select-Object -First 1
& (Join-Path $buildTools.FullName 'apksigner.bat') verify --verbose $apk
if ($LASTEXITCODE -ne 0) { throw 'apksigner verification failed' }
Write-Host "APK ready: $apk" -ForegroundColor Green
