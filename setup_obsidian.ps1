# setup_obsidian.ps1
$setupFile = "$env:TEMP\ObsidianSetup.exe"
$expectedSize = 339587200

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "AXOM Brain & Obsidian Integration Setup" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Cyan

# Wait for download to reach the complete file size
while ($true) {
    if (Test-Path $setupFile) {
        $curLen = (Get-Item $setupFile).Length
        $curMB = $curLen / 1MB
        $pct = [math]::Round(($curLen / $expectedSize) * 100, 1)
        Write-Host ("Obsidian Setup downloading: {0:N1} MB / 323.8 MB ({1}%)" -f $curMB, $pct) -ForegroundColor DarkGray
        if ($curLen -ge $expectedSize) {
            break
        }
    }
    Start-Sleep -Seconds 6
}

Write-Host "Download complete! Allowing file stream to finalize..." -ForegroundColor Green
Start-Sleep -Seconds 3

# Wait for file lock release
$unlocked = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $stream = [System.IO.File]::Open($setupFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
        if ($stream) {
            $stream.Close()
            $stream.Dispose()
            $unlocked = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
    }
}

if (Test-Path $setupFile) {
    Write-Host "Running silent installation of Obsidian..." -ForegroundColor Green
    Start-Process -FilePath $setupFile -ArgumentList "/S" -Wait
    Start-Sleep -Seconds 4

    # Locate executable
    $exeCandidates = @(
        "$env:LOCALAPPDATA\Obsidian\Obsidian.exe",
        "C:\Program Files\Obsidian\Obsidian.exe",
        "C:\Program Files (x86)\Obsidian\Obsidian.exe"
    )

    $installed = $null
    foreach ($cand in $exeCandidates) {
        if (Test-Path $cand) {
            $installed = $cand
            break
        }
    }

    $vaultPath = "$env:USERPROFILE\Documents\Axom_Brain"
    if ($installed) {
        Write-Host "Obsidian installed successfully at: $installed" -ForegroundColor Green
        Write-Host "Launching Obsidian with AXOM Brain vault at: $vaultPath" -ForegroundColor Cyan
        Start-Process -FilePath $installed -ArgumentList "`"$vaultPath`""
    } else {
        Write-Host "Launching Obsidian via Windows URI protocol..." -ForegroundColor Yellow
        Start-Process "obsidian://open?path=$([uri]::EscapeDataString($vaultPath))"
    }
} else {
    Write-Host "Setup file not found at $setupFile" -ForegroundColor Red
}
