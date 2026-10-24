Add-Type -AssemblyName System.Drawing

$folder = "C:\Users\kipto\OneDrive\Pictures\club logos"
$files = Get-ChildItem -LiteralPath $folder

foreach ($f in $files) {
    $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $c0 = $bmp.GetPixel(2, 2)
    $c1 = $bmp.GetPixel($bmp.Width - 3, 2)
    $c2 = $bmp.GetPixel(2, $bmp.Height - 3)
    $c3 = $bmp.GetPixel($bmp.Width - 3, $bmp.Height - 3)
    Write-Output ("{0} | Size: {1}x{2} | TL: ({3},{4},{5}) | TR: ({6},{7},{8}) | BL: ({9},{10},{11}) | BR: ({12},{13},{14})" -f `
        $f.Name, $bmp.Width, $bmp.Height, `
        $c0.R, $c0.G, $c0.B, `
        $c1.R, $c1.G, $c1.B, `
        $c2.R, $c2.G, $c2.B, `
        $c3.R, $c3.G, $c3.B)
    $bmp.Dispose()
}
