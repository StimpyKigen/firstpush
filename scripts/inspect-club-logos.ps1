Add-Type -AssemblyName System.Drawing

$folder = "C:\Users\kipto\OneDrive\Pictures\club logos"
$files = Get-ChildItem -LiteralPath $folder

$results = foreach ($f in $files) {
    try {
        $img = [System.Drawing.Image]::FromFile($f.FullName)
        [PSCustomObject]@{
            Name   = $f.Name
            Width  = $img.Width
            Height = $img.Height
            SizeKB = [math]::Round($f.Length / 1KB, 1)
        }
        $img.Dispose()
    }
    catch {
        [PSCustomObject]@{
            Name   = $f.Name
            Width  = -1
            Height = -1
            SizeKB = [math]::Round($f.Length / 1KB, 1)
        }
    }
}

$results | Format-Table -AutoSize
