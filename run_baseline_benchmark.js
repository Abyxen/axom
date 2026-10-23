const fs = require('fs');

const model = "qwen2.5:7b";
const baseUrl = "http://127.0.0.1:8000/api/chat";

const benchmarkTests = [
  {
    id: 1,
    category: "Identity & Creator Origin",
    prompt: "Who created you, who are you, and what is your purpose?",
    temperature: 0.5,
    max_tokens: 250
  },
  {
    id: 2,
    category: "Conversational Chat & Philosophy",
    prompt: "Give me your personal philosophy on why someone would want a private, local AI assistant instead of big-tech cloud models.",
    temperature: 0.7,
    max_tokens: 350
  },
  {
    id: 3,
    category: "Python Algorithm & Analysis",
    prompt: "Write an optimal Python function to find the length of the longest substring without repeating characters. Include clear docstrings, inline comments, and analyze both time and space complexity.",
    temperature: 0.2,
    max_tokens: 450
  },
  {
    id: 4,
    category: "Code Debugging & Refactoring",
    prompt: `Find all bugs and security/performance issues in this JavaScript snippet and write the corrected version:
\`\`\`javascript
function fetchUserData(userId) {
  let user;
  fetch('http://api.example.com/users/' + userId)
    .then(res => res.json())
    .then(data => { user = data; });
  return user;
}
\`\`\``,
    temperature: 0.3,
    max_tokens: 450
  },
  {
    id: 5,
    category: "System Architecture & Engineering",
    prompt: "Design a lightweight in-memory token-bucket rate limiter class in Python without using external database dependencies. Show code and explain how it handles bursts.",
    temperature: 0.3,
    max_tokens: 500
  }
];

async function runBenchmark() {
  console.log("==================================================");
  console.log("AXOM BASELINE BENCHMARK EXECUTION (UNTRAINED MODEL)");
  console.log("Testing Base Model:", model);
  console.log("==================================================\n");

  const results = [];

  for (const test of benchmarkTests) {
    console.log(`[Test ${test.id}/5] Category: ${test.category}`);
    console.log(`Prompt: "${test.prompt.slice(0, 60)}..."`);
    console.log(`Sending inference request...`);

    const startTime = Date.now();
    const payload = {
      model: model,
      messages: [{ role: "user", content: test.prompt }],
      params: {
        temperature: test.temperature,
        max_tokens: test.max_tokens
      }
    };

    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const answer = data.message?.content || "";

      console.log(`✅ Finished in ${elapsedSec}s (${answer.length} chars)`);
      console.log(`Preview: ${answer.slice(0, 100).replace(/\n/g, ' ')}...\n`);

      results.push({
        id: test.id,
        category: test.category,
        prompt: test.prompt,
        durationSeconds: Number(elapsedSec),
        characterCount: answer.length,
        response: answer
      });
    } catch (err) {
      console.error(`❌ Error in test ${test.id}:`, err.message);
    }
  }

  fs.writeFileSync('benchmark_raw.json', JSON.stringify(results, null, 2), 'utf8');
  console.log("==================================================");
  console.log("BENCHMARK FINISHED! Saved raw data to benchmark_raw.json");
  console.log("==================================================");
}

runBenchmark();
