Add-Type -AssemblyName System.Drawing

$srcDir = "C:\Users\kipto\OneDrive\Pictures\club logos"
$destDir = "c:\Users\kipto\OneDrive\Documents\Mshindi Claude\mshindi-phase-II-main\public\images\club-logos"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

$files = Get-ChildItem -LiteralPath $srcDir

Write-Output ("Found {0} files to process..." -f $files.Count)

$targetSize = 512

$manifest = @()

$index = 1
foreach ($f in $files) {
    # Generate clean normalized file name
    $cleanName = $f.BaseName
    # Replace non-ascii or weird characters
    $cleanName = $cleanName -replace '[^a-zA-Z0-9_\-\s]', ''
    $cleanName = $cleanName.Trim() -replace '\s+', '-'
    $cleanName = $cleanName.ToLower()
    if ([string]::IsNullOrWhiteSpace($cleanName)) {
        $cleanName = "club-logo-" + $index
    }
    $outFileName = ("logo-{0:D2}-{1}.png" -f $index, $cleanName)
    $outPath = Join-Path $destDir $outFileName

    try {
        $srcBmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
        $w = $srcBmp.Width
        $h = $srcBmp.Height

        # Create 512x512 32-bit ARGB bitmap
        $canvas = New-Object System.Drawing.Bitmap($targetSize, $targetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($canvas)
        
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

        # Calculate proportional scale to fit within targetSize while maintaining aspect ratio
        $scale = [Math]::Min(($targetSize / [double]$w), ($targetSize / [double]$h))
        $destW = [Math]::Round($w * $scale)
        $destH = [Math]::Round($h * $scale)
        $destX = [Math]::Round(($targetSize - $destW) / 2.0)
        $destY = [Math]::Round(($targetSize - $destH) / 2.0)

        $destRect = New-Object System.Drawing.Rectangle($destX, $destY, $destW, $destH)
        $srcRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)

        $g.DrawImage($srcBmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

        $canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

        $g.Dispose()
        $canvas.Dispose()
        $srcBmp.Dispose()

        $manifest += [PSCustomObject]@{
            Index       = $index
            Original    = $f.Name
            OutputName  = $outFileName
            OrigWidth   = $w
            OrigHeight  = $h
            CanvasWidth = $targetSize
            CanvasHeight= $targetSize
            ScaledWidth = $destW
            ScaledHeight= $destH
            Status      = "SUCCESS"
        }
        Write-Output ("[{0:D2}/20] Converted: {1} -> {2} ({3}x{4} in 512x512)" -f $index, $f.Name, $outFileName, $destW, $destH)
    }
    catch {
        Write-Error ("Failed processing {0}: {1}" -f $f.Name, $_.Exception.Message)
        $manifest += [PSCustomObject]@{
            Index       = $index
            Original    = $f.Name
            OutputName  = $outFileName
            Status      = "ERROR: " + $_.Exception.Message
        }
    }
    $index++
}

$manifest | Format-Table -AutoSize
