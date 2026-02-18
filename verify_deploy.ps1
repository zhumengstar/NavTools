$url = "http://localhost:8787"
$maxRetries = 30
$retryInterval = 2

Write-Host "Starting deployment verification for $url..."

for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Head -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "Create Success! Service is up and running." -ForegroundColor Green
            exit 0
        }
    }
    catch {
        $err = $_.Exception.Message
        Write-Host "Attempt ${i}/${maxRetries}: Waiting for service... ($err)" -ForegroundColor Yellow
    }
    Start-Sleep -Seconds $retryInterval
}

Write-Host "Deployment verification failed after $maxRetries attempts." -ForegroundColor Red
exit 1
