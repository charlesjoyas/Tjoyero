$ErrorActionPreference = 'Stop'
$packageWorkspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packageDirectory = Join-Path $packageWorkspace 'dist'
[System.IO.Directory]::CreateDirectory($packageDirectory) | Out-Null
$packageArchive = Join-Path $packageDirectory 'aurea-taller-vercel.zip'
if (-not ([System.IO.Path]::GetFullPath($packageArchive).StartsWith($packageWorkspace + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase))) {
    throw 'La ruta del paquete debe permanecer dentro del proyecto.'
}
$packageFiles = @(
    'package.json', 'pnpm-lock.yaml', 'vercel.json', '.vercelignore', '.gitignore', '.env.example',
    'index.html', 'app.js', 'numbers.js', 'labor-estimate.js', 'transport.js', 'styles.css', 'icon.svg',
    'excel-export.js', 'exceljs.min.js', 'EXCELJS-LICENSE.txt', 'scripts/vendor-excel.cjs',
    'production-metals.js',
    'deletions.cjs', 'gems.cjs',
    'server.cjs', 'domain.cjs', 'reversals.cjs', 'storage-schema.cjs', 'cloud-storage.cjs', 'transfers.cjs',
    'api/index.js', 'scripts/build-vercel.cjs', 'scripts/migrate-turso.cjs',
    'scripts/export-cloud-backup.cjs', 'scripts/package-vercel.ps1', 'VERCEL.md', 'README.md', 'REVISION-FINAL.md'
)
$packageFiles += Get-ChildItem -LiteralPath (Join-Path $packageWorkspace 'tests') -Recurse -File -Filter '*.cjs' | ForEach-Object {
    $_.FullName.Substring($packageWorkspace.Length + 1).Replace('\', '/')
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$packageStream = [System.IO.File]::Open($packageArchive, [System.IO.FileMode]::Create)
$packageZip = [System.IO.Compression.ZipArchive]::new($packageStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relativeFile in $packageFiles) {
        $sourceFile = Join-Path $packageWorkspace $relativeFile
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($packageZip, $sourceFile, $relativeFile, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $packageZip.Dispose()
    $packageStream.Dispose()
}
Write-Output "Paquete preparado: $packageArchive ($($packageFiles.Count) archivos; sin datos ni credenciales)."
