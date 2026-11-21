$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '../..')
$env:SITE_URL = 'https://arxipova.ru/'
$env:VITE_CONTACT_ENDPOINT = '/api/contact.php'
$env:VITE_CONTACT_LEGAL_READY = 'true'
try {
  npm run build -- --configLoader runner --base=/
  if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
  node qa/seo-check.mjs dist / https://arxipova.ru/
  if ($LASTEXITCODE -ne 0) { throw 'SEO check failed' }
  node security/scripts/prepare-apache.mjs dist
  if ($LASTEXITCODE -ne 0) { throw 'Apache preparation failed' }
} finally {
  Remove-Item Env:SITE_URL, Env:VITE_CONTACT_ENDPOINT, Env:VITE_CONTACT_LEGAL_READY -ErrorAction SilentlyContinue
}
$bundle = Join-Path (Get-Location) 'security/.generated/final-site'
New-Item -ItemType Directory -Force -Path "$bundle/public/api", "$bundle/private/runtime" | Out-Null
Copy-Item dist/* "$bundle/public" -Recurse -Force
Copy-Item security/.generated/.htaccess "$bundle/public/.htaccess" -Force
$entry = [IO.File]::ReadAllText((Join-Path (Get-Location) 'security/php/contact.php'))
$entry = $entry.Replace("getenv('ELENA_CONTACT_PRIVATE_DIR') ?: ''", "getenv('ELENA_CONTACT_PRIVATE_DIR') ?: dirname(__DIR__, 3) . '/private'")
[IO.File]::WriteAllText("$bundle/public/api/contact.php", $entry, [Text.UTF8Encoding]::new($false))
Copy-Item security/php/App.php "$bundle/private/App.php" -Force
Copy-Item security/vendor "$bundle/private/vendor" -Recurse -Force
Copy-Item security/config/reg-ru.example.php "$bundle/private/config.php" -Force
# ZipFile includes hidden .htaccess, unlike some Compress-Archive versions.
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($part in @('public','private')) {
  $archive = "$bundle/$part-final.zip"
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
  [IO.Compression.ZipFile]::CreateFromDirectory("$bundle/$part", $archive)
}
Write-Output "Deployment archives ready: $bundle"
