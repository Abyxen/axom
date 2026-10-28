const os = require('node:os');
const guard = require('./workspace_guard');

// Default built-in skills
const SKILLS = {
  file_system: {
    id: 'file_system',
    name: 'File System Manager',
    description: 'Create, read, edit, delete, and list files inside the permitted project workspace.',
    enabled: true,
    tools: [
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read the text content of a file located inside the project workspace directory.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file to read (e.g. "main.py" or "src/index.js")' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_file',
          description: 'Create a new file or overwrite an existing file with the provided text content inside the project workspace.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file to write (e.g. "app.py", "README.md")' },
              content: { type: 'string', description: 'The complete text content to write into the file' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'edit_file',
          description: 'Replace an exact target snippet within an existing file with a replacement snippet inside the project workspace.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file to edit' },
              target: { type: 'string', description: 'Exact string to locate in the file' },
              replacement: { type: 'string', description: 'New string to substitute in place of the target' }
            },
            required: ['path', 'target', 'replacement']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'delete_file',
          description: 'Delete a file or directory located inside the project workspace directory.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path of the file or folder to delete' }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_directory',
          description: 'List the files and subdirectories located inside the project workspace.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative directory path to list (use "" or "." for project root)' }
            }
          }
        }
      }
    ]
  },

  terminal: {
    id: 'terminal',
    name: 'Workspace Terminal Runner',
    description: 'Execute build tools, scripts, Python, Node, and test commands strictly inside the project workspace directory.',
    enabled: true,
    tools: [
      {
        type: 'function',
        function: {
          name: 'run_command',
          description: 'Execute a terminal command (PowerShell) strictly within the project workspace directory (e.g. "python script.py", "node -v", "npm test").',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The terminal command line to execute' }
            },
            required: ['command']
          }
        }
      }
    ]
  },

  web_tools: {
    id: 'web_tools',
    name: 'Web Fetcher & API Tool',
    description: 'Fetch text content or JSON from public web APIs or web pages.',
    enabled: true,
    tools: [
      {
        type: 'function',
        function: {
          name: 'fetch_web_url',
          description: 'Perform an HTTP GET request to fetch text, markdown, or JSON from an external URL.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The public HTTP/HTTPS URL to fetch' }
            },
            required: ['url']
          }
        }
      }
    ]
  },

  system_info: {
    id: 'system_info',
    name: 'Host Environment Inspector',
    description: 'Inspect current hardware environment, operating system, and workspace paths.',
    enabled: true,
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_environment_info',
          description: 'Retrieve safe system specs (OS, CPU cores, RAM, and active workspace path).',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      }
    ]
  }
};

/**
 * Execute a named tool with provided arguments in the context of a workspace
 */
async function executeTool(name, args = {}, context = {}) {
  const workspaceRoot = context.workspaceRoot || guard.getOrCreateWorkspace('default');
  const requireApproval = context.requireApproval || false;

  switch (name) {
    case 'read_file': {
      const content = await guard.safeReadFile(args.path, workspaceRoot);
      return JSON.stringify({ success: true, path: args.path, content });
    }

    case 'write_file': {
      const result = await guard.safeWriteFile(args.path, args.content || '', workspaceRoot);
      return JSON.stringify({ success: true, ...result });
    }

    case 'edit_file': {
      const result = await guard.safeEditFile(args.path, args.target, args.replacement, workspaceRoot);
      return JSON.stringify({ success: true, ...result });
    }

    case 'delete_file': {
      const result = await guard.safeDeleteFile(args.path, workspaceRoot);
      return JSON.stringify({ success: true, ...result });
    }

    case 'list_directory': {
      const entries = await guard.safeListDirectory(args.path || '', workspaceRoot);
      return JSON.stringify({ success: true, path: args.path || '.', entries });
    }

    case 'run_command': {
      const result = await guard.safeRunTerminalCommand(args.command, workspaceRoot);
      return JSON.stringify({
        success: result.exitCode === 0,
        command: result.command,
        exit_code: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr
      });
    }

    case 'fetch_web_url': {
      const response = await fetch(args.url, { signal: AbortSignal.timeout(10000) });
      const text = await response.text();
      // Cap at 20KB to prevent context bloat
      const preview = text.length > 20000 ? text.substring(0, 20000) + '\n...[truncated]' : text;
      return JSON.stringify({ success: response.ok, status: response.status, data: preview });
    }

    case 'get_environment_info': {
      return JSON.stringify({
        platform: os.platform(),
        release: os.release(),
        cpu_count: os.cpus().length,
        total_ram_gb: Math.round(os.totalmem() / (1024 ** 3)),
        free_ram_gb: Math.round(os.freemem() / (1024 ** 3)),
        workspace_directory: workspaceRoot
      });
    }

    default:
      throw new Error(`Unknown tool "${name}".`);
  }
}

/**
 * Get all active tools formatted for Ollama / OpenAI tool specification
 */
function getActiveTools(enabledSkillIds = null) {
  const tools = [];
  for (const skill of Object.values(SKILLS)) {
    const isEnabled = enabledSkillIds ? enabledSkillIds.includes(skill.id) : skill.enabled;
    if (isEnabled && Array.isArray(skill.tools)) {
      tools.push(...skill.tools);
    }
  }
  return tools;
}

/**
 * Get list of available skills and their descriptions
 */
function listSkills() {
  return Object.values(SKILLS).map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    enabled: s.enabled,
    tool_count: s.tools.length
  }));
}

/**
 * Toggle skill status
 */
function setSkillEnabled(skillId, enabled) {
  if (SKILLS[skillId]) {
    SKILLS[skillId].enabled = Boolean(enabled);
    return true;
  }
  return false;
}

module.exports = {
  SKILLS,
  executeTool,
  getActiveTools,
  listSkills,
  setSkillEnabled
};
