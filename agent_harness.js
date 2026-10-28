const guard = require('./workspace_guard');
const skills = require('./skills_registry');
const db = require('./db');

const DEFAULT_MODEL = 'axom:1.1';
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const MAX_AGENT_STEPS = 8;

/**
 * Build system prompt for Agentic Harness
 */
function buildAgentSystemPrompt(mode, workspacePath, enabledSkills = null) {
  const profileContext = db.formatProfileContext();

  let modeInstruction = '';
  if (mode === 'agent_plan') {
    modeInstruction = `
REASONING MODE: PLAN-FIRST
- Before executing any tools, outline a brief numbered plan of what you will do.
- Execute steps sequentially using your available tools.
- Verify your work before concluding.`;
  } else if (mode === 'agent_ask') {
    modeInstruction = `
REASONING MODE: SAFE PERMISSION (HUMAN-IN-THE-LOOP)
- Destructive file writes, deletions, and shell commands require user approval.
- Clearly describe what file or command you intend to modify before calling the tool.`;
  } else {
    modeInstruction = `
REASONING MODE: AUTONOMOUS AGENT (ACTIVE WORKSPACE)
- You have full permission to create, edit, read, and delete files and run commands STRICTLY inside your assigned project workspace.
- Proactively use tools to complete tasks end-to-end. If writing code, consider testing it using terminal commands.`;
  }

  return `${profileContext}

# [AXOM AGENTIC EXECUTION HARNESS]
You are operating in AGENTIC HARNESS MODE with tool-calling capabilities.
Assigned Workspace Root: "${workspacePath}"

CRITICAL SECURITY & SANDBOX RULES:
1. STRICT WORKSPACE BOUNDARY: You can ONLY read, write, edit, delete, and list files inside your assigned workspace directory. Any attempt to access files outside this directory (or in Windows system paths) is strictly blocked by the security sandbox.
2. RELATIVE PATHS: Always specify relative paths (e.g. "index.js", "src/main.py", "data/output.csv"). Never use absolute drive paths like "C:\\...".
3. TOOL EXECUTION: When the user asks you to create, modify, inspect, or build software, use your tools to actually perform the work rather than just printing raw instructions.
4. VERIFICATION: When you write code, use run_command to execute and verify that it compiles, runs, and produces the expected output.
${modeInstruction}
`;
}

/**
 * Main Agentic Execution Loop
 * Asynchronously runs the ReAct loop and yields progress events
 */
async function* runAgentHarness({
  model = DEFAULT_MODEL,
  messages = [],
  session_id = 'default',
  project_name = 'default',
  mode = 'agent_auto',
  enabled_skills = null,
  signal = null
}) {
  const workspacePath = guard.getOrCreateWorkspace(project_name);
  const activeTools = skills.getActiveTools(enabled_skills);

  // 1. Build initial messages array with sandboxed agent prompt
  const systemPrompt = buildAgentSystemPrompt(mode, workspacePath, enabled_skills);
  const workingMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system')
  ];

  let currentStep = 0;
  let isDone = false;
  const executedActions = [];

  yield {
    type: 'agent_start',
    mode,
    project_name,
    workspace_directory: workspacePath,
    tools_available: activeTools.map(t => t.function.name)
  };

  while (!isDone && currentStep < MAX_AGENT_STEPS) {
    if (signal?.aborted) {
      yield { type: 'error', message: 'Agent execution aborted by user.' };
      return;
    }

    currentStep++;

    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: workingMessages,
        tools: activeTools,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 2048,
          top_p: 0.9
        }
      }),
      signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      yield { type: 'error', message: `Ollama error (${response.status}): ${errText}` };
      return;
    }

    const data = await response.json();
    const assistantMsg = data.message || {};
    const toolCalls = assistantMsg.tool_calls || [];
    const textContent = assistantMsg.content || '';
    const thinking = assistantMsg.thinking || '';

    // Yield thinking/reasoning if present
    if (thinking) {
      yield { type: 'agent_thought', step: currentStep, thought: thinking };
    }

    // Case 1: Model wants to execute one or more tools
    if (toolCalls && toolCalls.length > 0) {
      workingMessages.push({
        role: 'assistant',
        content: textContent,
        tool_calls: toolCalls
      });

      for (const call of toolCalls) {
        const fnName = call.function?.name;
        let fnArgs = call.function?.arguments || {};
        if (typeof fnArgs === 'string') {
          try { fnArgs = JSON.parse(fnArgs); } catch (e) { fnArgs = {}; }
        }

        yield {
          type: 'tool_call',
          step: currentStep,
          id: call.id,
          name: fnName,
          args: fnArgs
        };

        let toolOutput = '';
        let success = true;

        try {
          toolOutput = await skills.executeTool(fnName, fnArgs, {
            workspaceRoot: workspacePath,
            mode
          });
        } catch (err) {
          success = false;
          toolOutput = JSON.stringify({
            success: false,
            error: err.name === 'SandboxSecurityError' ? `[SECURITY VIOLATION] ${err.message}` : err.message
          });
        }

        executedActions.push({
          tool: fnName,
          args: fnArgs,
          success
        });

        yield {
          type: 'tool_result',
          step: currentStep,
          id: call.id,
          name: fnName,
          success,
          output: toolOutput
        };

        // Feed tool result back into working messages
        workingMessages.push({
          role: 'tool',
          content: toolOutput,
          tool_call_id: call.id
        });
      }
    } 
    // Case 2: Model produced final text without tool calls
    else {
      isDone = true;
      if (textContent) {
        yield {
          type: 'text',
          step: currentStep,
          text: textContent
        };
      }
    }
  }

  if (currentStep >= MAX_AGENT_STEPS && !isDone) {
    yield {
      type: 'text',
      step: currentStep,
      text: '\n\n*(Agent reached maximum execution steps safety limit.)*'
    };
  }

  yield {
    type: 'agent_finish',
    total_steps: currentStep,
    actions_count: executedActions.length,
    actions: executedActions
  };
}

module.exports = {
  buildAgentSystemPrompt,
  runAgentHarness
};
