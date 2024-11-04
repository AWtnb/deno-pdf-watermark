$EXENAME = ($pwd).Path | Split-Path -Leaf

deno compile --allow-import --allow-read --allow-write .\main.ts

if ($LASTEXITCODE -eq 0) {
    if (Test-Path .\.env) {
        $d = (Get-Content .\.env -Raw).Trim()
        if ($d.Length -lt 1) {
            $d = $env:USERPROFILE | Join-Path -ChildPath "tools\bin"
        }
        $d = [System.Environment]::ExpandEnvironmentVariables($d)
        if (-not (Test-Path $d -PathType Container)) {
            New-Item -Path $d -ItemType Directory
        }
        $n = "{0}.exe" -f $EXENAME
        if (Test-Path $n) {
            Get-Item $n | Copy-Item -Destination $d -Force -ErrorAction Stop
            "COPIED {0} to: {1}" -f $n, $d | Write-Host -ForegroundColor Blue
        }
        else {
            "{0} not found!" -f $n | Write-Host -ForegroundColor Magenta
        }
    }
    else {
        ".env not found!" | Write-Host -ForegroundColor Magenta
    }
}
else {
    "Failed to build. Nothing was copied." | Write-Host -ForegroundColor Magenta
}

