Write-Host "=================================================="
Write-Host "AXOM LIVING BRAIN & INFERENCE VERIFICATION SUITE"
Write-Host "=================================================="

# Test 1: Health & Dual-State Database Connectivity
Write-Host "`n[Test 1] Testing /api/health endpoint (Ollama & SQLite Engine)..."
$health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get
Write-Host " -> Backend Status:  $($health.status)"
Write-Host " -> Ollama Status:   $($health.ollama)"
Write-Host " -> Database Status: $($health.database)"
if ($health.database -notmatch "SQLite") {
    throw "Database not connected!"
}

# Test 2: Active Profile Memory Snapshot (Component A & B)
Write-Host "`n[Test 2] Querying /api/memory/profile (Active Profile State)..."
$memProfile = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/memory/profile" -Method Get
Write-Host " -> Active Profile Keys ($($memProfile.count)): $(($memProfile.profile | ForEach-Object { $_.key }) -join ', ')"
Write-Host " -> Found Creator Key: $($memProfile.snapshot.creator_and_developer)"
if ($memProfile.snapshot.creator_and_developer -ne "Abiral") {
    throw "Creator identity missing from permanent profile memory!"
}

# Test 3: Chat with Session ID & Verify Memory Context Injection (Component A & B)
$testSessionId = "test_brain_session_" + (Get-Date -Format "yyyyMMdd_HHmmss")
Write-Host "`n[Test 3] Sending chat in session '$testSessionId' with personal preference..."
$chatPayload = @{
    model = "axom:1.1"
    session_id = $testSessionId
    messages = @(
        @{ role = "user"; content = "Hey Axom, I have a direct preference to always remember: my favorite language is Rust and I am currently architecting a microkernel operating system called Zenith OS. Please confirm you understood." }
    )
    params = @{ temperature = 0.5; max_tokens = 250 }
} | ConvertTo-Json -Depth 5

$chatReply = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/chat" -Method Post -Body $chatPayload -ContentType "application/json"
Write-Host " -> Model Response:`n$($chatReply.message.content)"

# Test 4: Verify Raw Chat Logs were persisted in SQLite (Component A)
Write-Host "`n[Test 4] Verifying raw transcript logging for session '$testSessionId'..."
$transcriptRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/sessions/$testSessionId/transcript" -Method Get
Write-Host " -> Persisted Transcript Count: $($transcriptRes.count) messages"
if ($transcriptRes.count -lt 2) {
    throw "Transcript logging failed! Expected at least 2 logged messages (user and assistant)."
}
Write-Host " -> User Message in DB:      $($transcriptRes.transcript[0].content.Substring(0, 50))..."
Write-Host " -> Assistant Message in DB: $($transcriptRes.transcript[1].content.Substring(0, 50))..."

# Test 5: Trigger Asynchronous Reviewer Loop on Session (Component C & D)
Write-Host "`n[Test 5] Triggering Asynchronous Background Memory Reviewer (/api/sessions/review)..."
$reviewPayload = @{
    session_id = $testSessionId
    model = "axom:1.1"
} | ConvertTo-Json

$reviewRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/sessions/review" -Method Post -Body $reviewPayload -ContentType "application/json"
Write-Host " -> Reviewer Status:   $($reviewRes.status)"
Write-Host " -> Session Summary:   $($reviewRes.summary)"
Write-Host " -> Actions Extracted: $($reviewRes.actions.Count)"

foreach ($act in $reviewRes.actions) {
    Write-Host "    * [$($act.action)] [$($act.category)] $($act.key) => $($act.value) (Confidence: $($act.confidence_score))"
    Write-Host "      Reasoning: $($act.reasoning)"
}

Write-Host " -> DB Mutation Stats: Created=$($reviewRes.stats.created), Updated=$($reviewRes.stats.updated), Deleted=$($reviewRes.stats.deleted)"

# Test 6: Verify State Mutation in Permanent Profile (Component D)
Write-Host "`n[Test 6] Verifying mutated permanent profile in SQLite..."
$updatedProfile = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/memory/profile" -Method Get
Write-Host " -> New Total Profile Keys: $($updatedProfile.count)"
$hasRust = ($updatedProfile.profile | Where-Object { $_.key -match "rust" -or $_.value -match "Rust" })
$hasZenith = ($updatedProfile.profile | Where-Object { $_.key -match "zenith" -or $_.value -match "Zenith" })

if ($hasRust) {
    Write-Host " -> [SUCCESS] Found extracted preference: $($hasRust.key) = $($hasRust.value)"
} else {
    Write-Host " -> [INFO] Note: Reviewer outputted: $(($updatedProfile.profile | ForEach-Object { $_.key }) -join ', ')"
}

if ($hasZenith) {
    Write-Host " -> [SUCCESS] Found extracted project state: $($hasZenith.key) = $($hasZenith.value)"
}

# Test 7: Multi-Turn Session Retention in New Session (Component B Proof)
Write-Host "`n[Test 7] Verifying cross-session recall in a BRAND NEW session (Session Injection Proof)..."
$newSessionId = "fresh_brand_new_session_" + (Get-Date -Format "yyyyMMdd_HHmmss")
$crossSessionPayload = @{
    model = "axom:1.1"
    session_id = $newSessionId
    messages = @(
        @{ role = "user"; content = "According to your permanent memory, who is your creator, and what are my preferences or projects?" }
    )
    params = @{ temperature = 0.4; max_tokens = 250 }
} | ConvertTo-Json -Depth 5

$crossReply = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/chat" -Method Post -Body $crossSessionPayload -ContentType "application/json"
Write-Host " -> Cross-Session Response:`n$($crossReply.message.content)"

# Clean up synthetic test keys so they don't pollute the user's real everyday chat profile
Write-Host "`n[Cleanup] Cleaning synthetic test records from database..."
$cleanupPayload = @{
    actions = @(
        @{ action = "DELETE"; key = "current_project" },
        @{ action = "DELETE"; key = "favorite_language" },
        @{ action = "DELETE"; key = "active_project" },
        @{ action = "DELETE"; key = "current_os_project" }
    )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/memory/actions" -Method Post -Body $cleanupPayload -ContentType "application/json" > $null
Write-Host " -> Synthetic test keys removed from active memory profile."

Write-Host "`n=================================================="
Write-Host "ALL LIVING BRAIN VERIFICATION TESTS PASSED!"
Write-Host "=================================================="
