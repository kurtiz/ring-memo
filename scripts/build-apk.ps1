param([switch]$SkipChecks)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:EXPO_NO_TELEMETRY = '1'
$env:CI = '1'
$env:NODE_ENV = 'production'
$env:GRADLE_USER_HOME = Join-Path $projectRoot '.gradle'

if (-not $env:JAVA_HOME) {
  $workspaceRuntime = Get-ChildItem (Join-Path $projectRoot '.tools/jdk21') -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'bin/java.exe') } | Select-Object -First 1
  $studioRuntime = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr'
  if ($workspaceRuntime) { $env:JAVA_HOME = $workspaceRuntime.FullName }
  elseif (Test-Path (Join-Path $studioRuntime 'bin/java.exe')) { $env:JAVA_HOME = $studioRuntime }
  else { throw 'Set JAVA_HOME to your Android-compatible Java installation.' }
}
$javaRelease = Get-Content (Join-Path $env:JAVA_HOME 'release') -Raw
$javaMajor = [regex]::Match($javaRelease, 'JAVA_VERSION="(\d+)').Groups[1].Value
if ($javaMajor -notin @('17', '21')) {
  throw "Use Java 21 for this Android build. JAVA_HOME currently selects Java $javaMajor."
}
if (-not $env:ANDROID_HOME) {
  $localSdk = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
  if (Test-Path $localSdk) { $env:ANDROID_HOME = $localSdk }
  else { throw 'Set ANDROID_HOME to your Android SDK installation.' }
}

# CMake 3.22.1 bundles Ninja 1.10.2, which cannot stat long pnpm paths.
# Keep the newer executable local; do not alter the SDK or Windows registry.
$ninjaDirectory = Join-Path $projectRoot '.tools/ninja'
$ninjaExecutable = Join-Path $ninjaDirectory 'ninja.exe'
if (-not (Test-Path -LiteralPath $ninjaExecutable)) {
  New-Item -ItemType Directory -Path $ninjaDirectory -Force | Out-Null
  $ninjaArchive = Join-Path $projectRoot '.tools/ninja-win.zip'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/ninja-build/ninja/releases/download/v1.13.2/ninja-win.zip' -OutFile $ninjaArchive
  $expectedNinjaHash = '07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65'
  if ((Get-FileHash -LiteralPath $ninjaArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedNinjaHash) {
    throw 'Ninja archive checksum mismatch.'
  }
  Expand-Archive -LiteralPath $ninjaArchive -DestinationPath $ninjaDirectory -Force
}
$env:RINGMEMO_NINJA = $ninjaExecutable.Replace('\', '/')

Push-Location $projectRoot
try {
  if (-not $SkipChecks) {
    & pnpm lint
    if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }
    & pnpm typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
    & pnpm test
    if ($LASTEXITCODE -ne 0) { throw 'Recording tests failed.' }
    & pnpm check:expo
    if ($LASTEXITCODE -ne 0) { throw 'Expo Doctor failed.' }
  }
  & pnpm --filter '@ringmemo/mobile' exec expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }
  Push-Location (Join-Path $projectRoot 'apps/mobile/android')
  try {
    & ./gradlew.bat :app:assembleRelease :ringmemo-recorder:testReleaseUnitTest --no-daemon --max-workers=2 '-PreactNativeArchitectures=arm64-v8a'
    if ($LASTEXITCODE -ne 0) { throw 'Android APK build or native tests failed.' }
  } finally { Pop-Location }
  $artifacts = Join-Path $projectRoot 'artifacts'
  New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
  $destination = Join-Path $artifacts 'ringmemo-a21s.apk'
  Copy-Item -LiteralPath (Join-Path $projectRoot 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk') -Destination $destination -Force
  Write-Output "APK: $destination"
} finally { Pop-Location }
