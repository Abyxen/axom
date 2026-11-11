/**
 * AXOM Model Context Protocol (MCP) Client & Autonomous Tool Registry
 * Connects AXOM to local system capabilities, Python calculation engine,
 * living memory, and standard MCP protocol servers.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');

let db = null;
let obsidianVault = null;
try { db = require('./db'); } catch (e) {}
try { obsidianVault = require('./obsidian_vault'); } catch (e) {}

const CONFIG_PATH = path.join(__dirname, 'mcp_config.json');

// Default MCP Configuration
function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.warn('[MCP] Warning parsing mcp_config.json:', e.message);
    }
  }
  return {
    version: '1.0',
    mcpServers: {
      local_tools: {
        enabled: true,
        description: 'Native high-performance local tools for AXOM'
      }
    }
  };
}

// Tool Definitions for Ollama / LLM Tool Calling
const MCP_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'system_info',
      description: 'Inspect real-time machine hardware specifications including OS, CPU, RAM, and NVIDIA GPU telemetry.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_or_eval',
      description: 'Execute a Python script or high-precision mathematical calculation. Use this whenever asked to calculate complex math, statistics, verify proofs, or execute algorithms.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The Python 3 code to execute. Must print the final computed answer to standard output.'
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_living_memory',
      description: 'Search long-term memory records and Obsidian Second Brain notes for user preferences, facts, past conversations, and project files.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keywords or search topic to look up in the user memory base.'
          }
        },
        required: ['query']
      }
    }
  }
];

/**
 * Execute system_info
 */
async function executeSystemInfo() {
  const cpus = os.cpus();
  const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
  const freeMemGB = (os.freemem() / (1024 ** 3)).toFixed(2);
  
  let gpuInfo = 'GPU telemetry unavailable';
  try {
    const nvidiaOut = execSync('nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader,nounits', { timeout: 3000 }).toString().trim();
    if (nvidiaOut) {
      const parts = nvidiaOut.split(',').map(s => s.trim());
      gpuInfo = `GPU: ${parts[0]} | Total VRAM: ${parts[1]} MB | Free VRAM: ${parts[2]} MB | Driver: ${parts[3]}`;
    }
  } catch (e) {}

  return {
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: cpus.length ? `${cpus[0].model} (${cpus.length} cores)` : 'Unknown CPU',
    memory: {
      total: `${totalMemGB} GB`,
      free: `${freeMemGB} GB`,
      used_percent: `${(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(1)}%`
    },
    gpu: gpuInfo,
    uptime_hours: (os.uptime() / 3600).toFixed(1),
    timestamp: new Date().toISOString()
  };
}

/**
 * Execute calculate_or_eval safely using Python
 */
async function executeCalculateOrEval(code) {
  if (!code || typeof code !== 'string') {
    return { error: 'Missing or invalid code string' };
  }

  // Prepend safety and precision wrappers
  const wrappedCode = `
import sys, math
try:
    import numpy as np
except:
    pass

${code}
`;

  return new Promise((resolve) => {
    const py = execFile('python', ['-c', wrappedCode], { timeout: 8000 }, (err, stdout, stderr) => {
      if (err) {
        if (err.killed) {
          return resolve({ error: 'Execution timed out after 8 seconds' });
        }
        return resolve({
          error: stderr.trim() || err.message,
          exitCode: err.code
        });
      }
      resolve({
        success: true,
        output: stdout.trim() || '(Code executed with no stdout)'
      });
    });
  });
}

/**
 * Execute search_living_memory
 */
async function executeSearchLivingMemory(query) {
  if (!query || typeof query !== 'string') {
    return { error: 'Missing query parameter' };
  }

  const results = [];
  const qLower = query.toLowerCase();

  // Search SQLite Living Memories
  if (db && typeof db.listMemories === 'function') {
    try {
      const memories = db.listMemories() || [];
      for (const m of memories) {
        const text = `${m.key || ''} ${m.value || ''}`.toLowerCase();
        if (text.includes(qLower)) {
          results.push({
            type: 'memory_record',
            key: m.key,
            value: m.value,
            confidence: m.confidence || 1.0,
            source: 'db'
          });
        }
      }
    } catch (e) {}
  }

  // Search Obsidian Second Brain Vault
  if (obsidianVault && typeof obsidianVault.getRelevantKnowledge === 'function') {
    try {
      const vaultNotes = obsidianVault.getRelevantKnowledge(query);
      if (vaultNotes) {
        results.push({
          type: 'vault_knowledge',
          content: vaultNotes,
          source: 'obsidian_vault'
        });
      }
    } catch (e) {}
  }

  return {
    query,
    count: results.length,
    results: results.slice(0, 10)
  };
}

/**
 * Dispatch tool execution
 */
async function executeTool(name, args = {}) {
  switch (name) {
    case 'system_info':
      return await executeSystemInfo();
    case 'calculate_or_eval':
      return await executeCalculateOrEval(args.code);
    case 'search_living_memory':
      return await executeSearchLivingMemory(args.query);
    default:
      return { error: `Tool "${name}" is not handled by mcp_client` };
  }
}

function isMcpTool(name) {
  return MCP_TOOLS.some(t => t.function.name === name);
}

module.exports = {
  MCP_TOOLS,
  isMcpTool,
  executeTool,
  loadConfig
};
