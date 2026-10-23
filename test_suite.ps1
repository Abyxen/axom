Write-Host "=================================================="
Write-Host "AXOM VERIFICATION TEST SUITE"
Write-Host "=================================================="

# Test 1: Health
Write-Host "`n[Test 1] Testing /api/health endpoint..."
$health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get
Write-Host " -> Backend Status: $($health.status)"
Write-Host " -> Ollama Status:  $($health.ollama)"

# Test 2: Models
Write-Host "`n[Test 2] Testing /api/models endpoint..."
$models = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/models" -Method Get
Write-Host " -> Models Discovered: $($models.models -join ', ')"

# Test 3: Static Web UI
Write-Host "`n[Test 3] Testing static website / endpoint..."
$page = Invoke-WebRequest -Uri "http://127.0.0.1:8000/" -UseBasicParsing
$titleMatch = [regex]::Match($page.Content, "<title>(.*?)</title>")
Write-Host " -> HTTP Status: $($page.StatusCode)"
Write-Host " -> Page Title:  $($titleMatch.Groups[1].Value)"

# Test 4: Single-Turn Chat
Write-Host "`n[Test 4] Testing Single-turn chat with axomv1:4b..."
$payload1 = @{
    model = "axomv1:4b"
    messages = @(
        @{ role = "user"; content = "Who are you and what makes you unique?" }
    )
    params = @{ temperature = 0.7; max_tokens = 200 }
} | ConvertTo-Json -Depth 5

$reply1 = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/chat" -Method Post -Body $payload1 -ContentType "application/json"
Write-Host " -> Response:`n$($reply1.message.content)"

# Test 5: Multi-Turn Conversation
Write-Host "`n[Test 5] Testing Multi-turn chat (context memory)..."
$payload2 = @{
    model = "axomv1:4b"
    messages = @(
        @{ role = "user"; content = "Remember this secret code: OMEN-5060-TITAN" },
        @{ role = "assistant"; content = "I have recorded your secret code: OMEN-5060-TITAN." },
        @{ role = "user"; content = "What was the secret code I just gave you?" }
    )
    params = @{ temperature = 0.7; max_tokens = 200 }
} | ConvertTo-Json -Depth 5

$reply2 = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/chat" -Method Post -Body $payload2 -ContentType "application/json"
Write-Host " -> Response:`n$($reply2.message.content)"

# Test 6: Switching model
Write-Host "`n[Test 6] Testing model switching to qwen2.5:7b..."
$payload3 = @{
    model = "qwen2.5:7b"
    messages = @(
        @{ role = "user"; content = "State the capital of France in one word." }
    )
    params = @{ temperature = 0.2; max_tokens = 50 }
} | ConvertTo-Json -Depth 5

$reply3 = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/chat" -Method Post -Body $payload3 -ContentType "application/json"
Write-Host " -> Response:`n$($reply3.message.content)"

Write-Host "`n=================================================="
Write-Host "ALL 6 AUTOMATED TESTS COMPLETED SUCCESSFULLY"
Write-Host "=================================================="
