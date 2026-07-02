# Deploy the frontend build (dist/) to the EC2 instance running Nginx.
# Usage: .\deploy.ps1

$ErrorActionPreference = "Stop"

$KeyPath   = "D:\nexuscart.pem"
$Host_     = "ec2-52-54-72-227.compute-1.amazonaws.com"
$User      = "ec2-user"
$RemoteApp = "/var/www/design-themes-ux"
$Release   = Get-Date -Format "yyyyMMddHHmmss"
$RemoteRelease = "$RemoteApp/releases/$Release"

Write-Host "==> Building frontend..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

Write-Host "==> Creating release dir on server: $RemoteRelease" -ForegroundColor Cyan
ssh -i $KeyPath "$User@$Host_" "mkdir -p $RemoteRelease"
if ($LASTEXITCODE -ne 0) { throw "SSH mkdir failed" }

Write-Host "==> Uploading dist/ ..." -ForegroundColor Cyan
scp -i $KeyPath -r .\dist\* "${User}@${Host_}:${RemoteRelease}/"
if ($LASTEXITCODE -ne 0) { throw "scp upload failed" }

Write-Host "==> Switching 'current' symlink and reloading Nginx..." -ForegroundColor Cyan
$remoteCmd = "ln -sfn $RemoteRelease $RemoteApp/current && sudo systemctl reload nginx && cd $RemoteApp/releases && ls -1t | tail -n +6 | xargs -r rm -rf"
ssh -i $KeyPath "$User@$Host_" $remoteCmd
if ($LASTEXITCODE -ne 0) { throw "Remote switch failed" }

Write-Host "==> Deployed release $Release. Site: http://$Host_/" -ForegroundColor Green
