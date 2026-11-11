const db = require('./db');

const REVIEWER_SYSTEM_PROMPT = `# SYSTEM PROMPT: AI MEMORY REVIEWER & INSIGHT EXTRACTOR

## ROLE & OBJECTIVE
You are the asynchronous background "brain" processor for an advanced AI companion framework utilizing Qwen 3.5. Your job is to review a recent raw chat transcript between the User and the Assistant, analyze the context, track chronological events, and extract actionable, long-term memory updates. 

Your extraction must distill core facts, user preferences, project states, constraints, and meaningful personal details into a clean, permanent, structured schema. Do not capture transient conversational filler or short-term logic.

## INPUT FORMAT
You will be provided with a JSON payload containing:
1. \`current_profile\`: The existing dictionary of known facts about the user.
2. \`session_metadata\`: Details about the current chat session (Session ID, Start/End Timestamps).
3. \`chat_transcript\`: A chronological list of messages exchanged, each with a \`timestamp\`, \`role\` (user/assistant), and \`content\`.

## ANALYSIS CRITERIA
Carefully review the conversation logs to identify:
- **User Profile Updates:** Permanent personal preferences, style choices, structural defaults, names, locations, or habits.
- **Project Tracking & State:** Commitments, timelines, technical stacks, goals, blockers, or explicit decisions made regarding ongoing tasks.
- **Chronological Assertions:** Specific dates or time-relative commands (e.g., "I am launching this next Tuesday"). Cross-reference with the session timestamp to calculate absolute dates.
- **Explicit Memory Commands:** Statements where the user directly requests remembrance (e.g., "Remember this snippet," "Never suggest JavaScript to me again").

## OUTPUT FORMAT
You must return ONLY a raw valid JSON object. Do NOT write any "Thinking Process:", explanations, markdown fences, or conversational text. Start immediately with { and end with }. The structure must exactly match the schema below:

{
  "memory_actions": [
    {
      "action": "CREATE" | "UPDATE" | "DELETE",
      "category": "technical_stack" | "user_preference" | "project_milestone" | "personal_detail" | "general_fact",
      "key": "snake_case_identifier_for_the_fact",
      "value": "The distilled information, code snippet string, absolute date, or preference state.",
      "confidence_score": 0.0 to 1.0,
      "reasoning": "Brief explanation of why this was extracted or modified based on the transcript lines."
    }
  ],
  "session_summary": "A punchy, single-sentence summary of what this specific chat session accomplished for future reference tracking."
}

## OPERATIONAL RULES
1. **Deduplication:** If a fact already exists in \`current_profile\` and hasn't changed, do not output a \`CREATE\` or \`UPDATE\` action for it.
2. **Conflict Resolution:** If the user explicitly contradicts a piece of data in the \`current_profile\`, issue an \`UPDATE\` action with the new value.
3. **Temporal Anchoring:** Convert relative statements (e.g., "tomorrow", "next month") into absolute values using the message timestamps provided.
4. **Pruning:** If the user states a preference is no longer true (e.g., "I stopped working on that app"), issue a \`DELETE\` action for that specific key.`;

// In-memory queue and debounce timers
const debounceTimers = new Map();
const reviewQueue = [];
let isProcessingQueue = false;

/**
 * Clean and parse LLM JSON response safely
 */
function parseReviewerResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  let cleaned = rawText.trim();

  // Strip thinking tags if present
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/^<\/think>\s*/i, '').trim();

  // Strip markdown code fences if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }

  // Find opening and closing brackets if there's any stray text
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error('[REVIEWER] Failed to parse JSON response:', err.message, '\nRaw was:', rawText.slice(0, 300));
    return null;
  }
}

/**
 * COMPONENT C: Process review for a single session
 */
async function processSessionReview(sessionId, model = 'axom:1.1', ollamaBase = 'http://127.0.0.1:11434') {
  const transcript = db.getSessionTranscript(sessionId);
  if (!transcript || transcript.length === 0) {
    console.log(`[REVIEWER] Session ${sessionId} has no chat logs to review.`);
    return { status: 'skipped', reason: 'empty_transcript' };
  }

  const currentProfile = db.getProfileSnapshot();
  const sessionMeta = db.getSessionMetadata(sessionId) || {
    session_id: sessionId,
    start_time: transcript[0]?.timestamp || new Date().toISOString(),
    end_time: transcript[transcript.length - 1]?.timestamp || new Date().toISOString()
  };

  const payload = {
    current_profile: currentProfile,
    session_metadata: {
      session_id: sessionId,
      start_time: sessionMeta.start_time,
      end_time: sessionMeta.end_time
    },
    chat_transcript: transcript.map(t => ({
      timestamp: t.timestamp,
      role: t.role,
      content: t.content
    }))
  };

  console.log(`[REVIEWER] Reviewing session "${sessionId}" (${transcript.length} turns) with ${model}...`);

  try {
    const response = await fetch(`${ollamaBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: REVIEWER_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) }
        ],
        format: 'json',
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 2048,
          top_p: 0.9
        }
      }),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let rawContent = data.message?.content || data.response || '';
    if (!rawContent && data.message?.thinking) {
      rawContent = data.message.thinking;
    }
    const reviewResult = parseReviewerResponse(rawContent);

    if (!reviewResult || !Array.isArray(reviewResult.memory_actions)) {
      console.warn(`[REVIEWER] Invalid schema returned for session ${sessionId}. Response:`, rawContent);
      return { status: 'error', reason: 'invalid_schema', raw: rawContent };
    }

    // COMPONENT D: STATE MUTATION & DISPATCH
    const stats = db.applyMemoryActions(
      reviewResult.memory_actions,
      sessionId,
      reviewResult.session_summary || null
    );

    console.log(`[REVIEWER] Session ${sessionId} review completed successfully.`);
    console.log(`[REVIEWER] Actions applied: Created=${stats.created}, Updated=${stats.updated}, Deleted=${stats.deleted}`);
    if (reviewResult.session_summary) {
      console.log(`[REVIEWER] Summary: "${reviewResult.session_summary}"`);
    }

    // COMPONENT E: OBSIDIAN SECOND BRAIN REAL-TIME VAULT SYNC
    try {
      const obsidianVault = require('./obsidian_vault');
      obsidianVault.syncAll();
      console.log(`[REVIEWER] Obsidian Second Brain synced with vault at ${obsidianVault.VAULT_PATH}`);
    } catch (obsidianErr) {
      console.warn('[REVIEWER] Failed to sync with Obsidian vault:', obsidianErr.message);
    }

    return {
      status: 'success',
      session_id: sessionId,
      actions: reviewResult.memory_actions,
      summary: reviewResult.session_summary,
      stats
    };
  } catch (err) {
    console.error(`[REVIEWER] Error reviewing session ${sessionId}:`, err.message);
    return { status: 'error', error: err.message };
  }
}

/**
 * Queue runner: processes reviews sequentially
 */
async function processQueue(model, ollamaBase) {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (reviewQueue.length > 0) {
      const { sessionId, resolve, reject } = reviewQueue.shift();
      try {
        const result = await processSessionReview(sessionId, model, ollamaBase);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Trigger immediate session review (enqueued)
 */
function triggerSessionReviewNow(sessionId, model = 'axom:1.1', ollamaBase = 'http://127.0.0.1:11434') {
  if (debounceTimers.has(sessionId)) {
    clearTimeout(debounceTimers.get(sessionId));
    debounceTimers.delete(sessionId);
  }

  return new Promise((resolve, reject) => {
    // Avoid duplicate queue entries
    const existing = reviewQueue.find(item => item.sessionId === sessionId);
    if (existing) {
      existing.resolve = resolve;
      existing.reject = reject;
      return;
    }

    reviewQueue.push({ sessionId, resolve, reject });
    processQueue(model, ollamaBase);
  });
}

/**
 * Schedule session review after activity break / debounce period
 * @param {string} sessionId
 * @param {number} delayMs default 15,000 ms (15 seconds after last message)
 */
function scheduleSessionReview(sessionId, delayMs = 15000, model = 'axom:1.1', ollamaBase = 'http://127.0.0.1:11434') {
  if (!sessionId) return;

  if (debounceTimers.has(sessionId)) {
    clearTimeout(debounceTimers.get(sessionId));
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(sessionId);
    triggerSessionReviewNow(sessionId, model, ollamaBase).catch(err => {
      console.error(`[REVIEWER] Debounced review failed for ${sessionId}:`, err.message);
    });
  }, delayMs);

  debounceTimers.set(sessionId, timer);
}

module.exports = {
  REVIEWER_SYSTEM_PROMPT,
  processSessionReview,
  triggerSessionReviewNow,
  scheduleSessionReview,
  parseReviewerResponse
};
