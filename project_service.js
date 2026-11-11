const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

const PROJECTS_ROOT = path.join(__dirname, 'workspace', 'projects');

// Ensure projects root directory exists
if (!fs.existsSync(PROJECTS_ROOT)) {
  fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
}

// Active project memory state
let activeProjectName = 'default-project';

/**
 * Initialize default project with starter template if none exists
 */
function initDefaultProject() {
  const defaultDir = path.join(PROJECTS_ROOT, 'default-project');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
    fs.writeFileSync(path.join(defaultDir, 'README.md'), `# Default Project Workspace\n\nThis project is your isolated sandbox.\nAxom has full access to read, create, and modify files strictly inside this directory.\n`, 'utf8');
    fs.writeFileSync(path.join(defaultDir, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>My Project</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Welcome to your Project</h1>\n  <p>Ask Axom to modify this file or add new features!</p>\n</body>\n</html>\n`, 'utf8');
    fs.writeFileSync(path.join(defaultDir, 'style.css'), `body {\n  font-family: system-ui, sans-serif;\n  background: #121215;\n  color: #f4f4f6;\n  padding: 40px;\n}\nh1 {\n  color: #ff512f;\n}\n`, 'utf8');
  }
}

initDefaultProject();

/**
 * Sanitize and validate project name
 */
function sanitizeProjectName(name) {
  if (!name || typeof name !== 'string') return 'default-project';
  const clean = name.replace(/[^\w.-]/g, '_').trim();
  return clean || 'default-project';
}

/**
 * Resolve and verify that a path strictly resides within the project directory
 */
function resolveProjectPath(projectName, relPath = '') {
  const safeProject = sanitizeProjectName(projectName || activeProjectName);
  const projectDir = path.resolve(PROJECTS_ROOT, safeProject);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Normalize relative path
  let targetRel = relPath ? String(relPath).replace(/^[\\\/]+/, '') : '';
  const resolved = path.resolve(projectDir, targetRel);

  // Strict Sandboxing: Must start with projectDir
  if (!resolved.startsWith(projectDir)) {
    throw new Error(`Security Exception: Path '${relPath}' escapes project boundary for '${safeProject}'.`);
  }

  return { projectDir, targetPath: resolved, safeProject, relativePath: path.relative(projectDir, resolved).replace(/\\/g, '/') };
}

/**
 * List all available projects
 */
function listProjects() {
  if (!fs.existsSync(PROJECTS_ROOT)) return [];
  const entries = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true });
  const projects = [];

  for (const ent of entries) {
    if (ent.isDirectory()) {
      const pDir = path.join(PROJECTS_ROOT, ent.name);
      const files = listProjectFiles(ent.name);
      projects.push({
        name: ent.name,
        path: pDir,
        fileCount: files.length,
        isActive: ent.name === activeProjectName
      });
    }
  }

  return projects;
}

/**
 * Create a new project directory
 */
function createProject(name) {
  const safe = sanitizeProjectName(name);
  const pDir = path.join(PROJECTS_ROOT, safe);
  if (!fs.existsSync(pDir)) {
    fs.mkdirSync(pDir, { recursive: true });
    fs.writeFileSync(path.join(pDir, 'README.md'), `# ${safe}\n\nProject workspace initialized.\n`, 'utf8');
  }
  activeProjectName = safe;
  return { success: true, name: safe, path: pDir };
}

/**
 * Get or set active project
 */
function getActiveProject() {
  return activeProjectName;
}

function setActiveProject(name) {
  const safe = sanitizeProjectName(name);
  const pDir = path.join(PROJECTS_ROOT, safe);
  if (!fs.existsSync(pDir)) {
    fs.mkdirSync(pDir, { recursive: true });
  }
  activeProjectName = safe;
  return { success: true, activeProject: safe };
}

/**
 * List all files inside a project recursively
 */
function listProjectFiles(projectName, subfolder = '') {
  const { projectDir, targetPath } = resolveProjectPath(projectName, subfolder);
  if (!fs.existsSync(targetPath)) return [];

  const results = [];
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(projectDir, full).replace(/\\/g, '/');
      if (ent.isDirectory()) {
        scan(full);
      } else {
        const stat = fs.statSync(full);
        results.push({
          name: ent.name,
          path: rel,
          size: stat.size,
          modified: stat.mtime.toISOString(),
          ext: path.extname(ent.name).toLowerCase()
        });
      }
    }
  }

  scan(targetPath);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Read file contents inside a project
 */
function readProjectFile(projectName, filePath) {
  const { targetPath, relativePath } = resolveProjectPath(projectName, filePath);
  if (!fs.existsSync(targetPath)) {
    return { error: `File '${relativePath}' does not exist in project.` };
  }
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    return { error: `'${relativePath}' is a directory. Use list_project_files instead.` };
  }
  if (stat.size > 2 * 1024 * 1024) {
    return { error: `File '${relativePath}' exceeds 2MB size limit.` };
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf8');
    const lines = content.split('\n').length;
    return {
      success: true,
      path: relativePath,
      content,
      sizeBytes: stat.size,
      lineCount: lines,
      modified: stat.mtime.toISOString()
    };
  } catch (err) {
    return { error: `Failed to read '${relativePath}': ${err.message}` };
  }
}

/**
 * Write or overwrite a file inside a project
 */
function writeProjectFile(projectName, filePath, content) {
  const { targetPath, relativePath } = resolveProjectPath(projectName, filePath);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    fs.writeFileSync(targetPath, fileContent, 'utf8');
    const stat = fs.statSync(targetPath);
    return {
      success: true,
      action: 'write',
      path: relativePath,
      sizeBytes: stat.size,
      lineCount: fileContent.split('\n').length,
      modified: stat.mtime.toISOString()
    };
  } catch (err) {
    return { error: `Failed to write '${relativePath}': ${err.message}` };
  }
}

/**
 * Modify / search-and-replace within an existing file inside a project
 */
function modifyProjectFile(projectName, filePath, searchTarget, replacement) {
  const { targetPath, relativePath } = resolveProjectPath(projectName, filePath);
  if (!fs.existsSync(targetPath)) {
    return { error: `File '${relativePath}' does not exist. Use project_write_file to create it.` };
  }

  try {
    const original = fs.readFileSync(targetPath, 'utf8');
    if (!original.includes(searchTarget)) {
      return {
        error: `Target text not found in '${relativePath}'. Please verify exact characters or use project_write_file to replace the entire content.`
      };
    }

    const updated = original.replace(searchTarget, replacement);
    fs.writeFileSync(targetPath, updated, 'utf8');
    const stat = fs.statSync(targetPath);

    return {
      success: true,
      action: 'modify',
      path: relativePath,
      sizeBytes: stat.size,
      lineCount: updated.split('\n').length,
      modified: stat.mtime.toISOString()
    };
  } catch (err) {
    return { error: `Failed to modify '${relativePath}': ${err.message}` };
  }
}

/**
 * Delete a file inside a project
 */
function deleteProjectFile(projectName, filePath) {
  const { targetPath, relativePath } = resolveProjectPath(projectName, filePath);
  if (!fs.existsSync(targetPath)) {
    return { error: `File '${relativePath}' does not exist.` };
  }

  try {
    fs.unlinkSync(targetPath);
    return { success: true, action: 'delete', path: relativePath };
  } catch (err) {
    return { error: `Failed to delete '${relativePath}': ${err.message}` };
  }
}

/**
 * Save uploaded file into project
 */
function saveUploadedProjectFile(projectName, filename, content) {
  const { targetPath, relativePath } = resolveProjectPath(projectName, filename);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (Buffer.isBuffer(content)) {
    fs.writeFileSync(targetPath, content);
  } else if (typeof content === 'string' && content.startsWith('data:')) {
    const base64Index = content.indexOf(';base64,');
    if (base64Index !== -1) {
      fs.writeFileSync(targetPath, Buffer.from(content.slice(base64Index + 8), 'base64'));
    } else {
      fs.writeFileSync(targetPath, content, 'utf8');
    }
  } else {
    fs.writeFileSync(targetPath, content, 'utf8');
  }

  const stat = fs.statSync(targetPath);
  return {
    success: true,
    path: relativePath,
    sizeBytes: stat.size,
    modified: stat.mtime.toISOString()
  };
}

/**
 * Execute script or command within the project directory
 */
function executeProjectCommand(projectName, command, timeoutMs = 10000) {
  const { projectDir, safeProject } = resolveProjectPath(projectName);
  
  // Whitelist basic safe developer run commands: node, python, npm, git status/diff
  const firstWord = (command || '').trim().split(/\s+/)[0].toLowerCase();
  const allowed = ['node', 'python', 'python3', 'npm', 'tsc', 'echo', 'git'];
  if (!allowed.includes(firstWord)) {
    return Promise.resolve({
      error: `Command '${firstWord}' is restricted. Allowed execution commands inside project: ${allowed.join(', ')}.`
    });
  }

  return new Promise((resolve) => {
    exec(command, { cwd: projectDir, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        command,
        project: safeProject,
        exitCode: err ? (err.code || 1) : 0,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        timedOut: err && err.killed === true
      });
    });
  });
}

/**
 * Schema definitions for Ollama Tool Calling in Project Mode
 */
const PROJECT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'project_list_files',
      description: 'Lists all files, file sizes, and directory structures inside the active project sandbox.',
      parameters: {
        type: 'object',
        properties: {
          subfolder: {
            type: 'string',
            description: 'Optional subfolder within the project to list. Defaults to root of project.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'project_read_file',
      description: 'Reads the exact text content of a file located within the project.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Relative path of the file to read (e.g. "index.html", "src/main.js").'
          }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'project_write_file',
      description: 'Creates a new file or completely replaces the content of an existing file in the project.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Relative path of the file to create or overwrite (e.g. "style.css", "app.py").'
          },
          content: {
            type: 'string',
            description: 'The complete text content to write into the file.'
          }
        },
        required: ['file_path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'project_modify_file',
      description: 'Modifies an existing file in the project by finding target text and replacing it with new text.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Relative path of the file to modify.'
          },
          search_target: {
            type: 'string',
            description: 'The exact string sequence in the file to be replaced.'
          },
          replacement: {
            type: 'string',
            description: 'The new string sequence to replace the target with.'
          }
        },
        required: ['file_path', 'search_target', 'replacement']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'project_delete_file',
      description: 'Deletes a file located inside the project sandbox.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Relative path of the file to delete.'
          }
        },
        required: ['file_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'project_run_code',
      description: 'Executes a test or script inside the project directory (e.g. "node server.js" or "python script.py") and returns stdout/stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute (e.g. "node index.js", "python test.py").'
          }
        },
        required: ['command']
      }
    }
  }
];

/**
 * Dispatch and execute project tool
 */
async function executeProjectTool(toolName, args = {}, projectName = activeProjectName) {
  const pName = projectName || activeProjectName;
  switch (toolName) {
    case 'project_list_files':
      return { files: listProjectFiles(pName, args.subfolder || '') };
    case 'project_read_file':
      return readProjectFile(pName, args.file_path || args.path || args.filepath);
    case 'project_write_file':
      return writeProjectFile(pName, args.file_path || args.path || args.filepath, args.content || '');
    case 'project_modify_file':
      return modifyProjectFile(
        pName,
        args.file_path || args.path || args.filepath,
        args.search_target || args.target,
        args.replacement || args.replace || ''
      );
    case 'project_delete_file':
      return deleteProjectFile(pName, args.file_path || args.path || args.filepath);
    case 'project_run_code':
      return await executeProjectCommand(pName, args.command || '');
    default:
      return { error: `Unknown project tool: '${toolName}'` };
  }
}

/**
 * Generate strict System Prompt directive for Project Sandbox Mode
 */
function getProjectDirective(projectName = activeProjectName) {
  const safeProject = sanitizeProjectName(projectName);
  const files = listProjectFiles(safeProject);
  const fileSummary = files.length > 0
    ? files.map(f => `  - ${f.path} (${f.size} bytes)`).join('\n')
    : '  (Project directory is currently empty)';

  return `\n\n# ACTIVE PROJECT SANDBOX MODE (Project: "${safeProject}"):
You are operating in strict PROJECT WORKSPACE MODE.
Your execution scope is exclusively sandboxed to the project directory: "${safeProject}".
You have direct autonomous tools to inspect, read, create, modify, and delete files inside this project:
- project_list_files: inspect project structure.
- project_read_file: read file contents.
- project_write_file: create or overwrite files on disk.
- project_modify_file: perform surgical edits on existing files.
- project_delete_file: delete a file.
- project_run_code: run scripts inside the project directory.

CURRENT FILES IN PROJECT:
${fileSummary}

CRITICAL OPERATIONAL PRINCIPLES:
1. STRICT SANDBOX CONTAINMENT: You ONLY have access to files inside this project. Do NOT attempt to read, write, or access files outside "${safeProject}". All paths must be relative to the project root.
2. FULL WRITE & EDIT ACCESS: When the user asks you to modify a file, write code, implement a feature, or fix a bug, DO NOT merely output a markdown code snippet. You MUST invoke the appropriate tool (project_write_file or project_modify_file) to apply the change directly to the file on disk!
3. CODE INTEGRITY: Read files with project_read_file before modifying them if you are unsure of their current state.
4. ZERO EMOJIS: Maintain a clean, professional, senior-engineer technical tone with zero decorative emojis.`;
}

/**
 * Heuristic detector for project intent
 */
function isProjectTask(text) {
  if (!text || typeof text !== 'string') return false;
  const q = text.toLowerCase();
  const patterns = [
    /\b(in\s+my\s+project|in\s+the\s+project|project\s+files?|project\s+mode)\b/i,
    /\b(modify\s+file|edit\s+file|change\s+file|update\s+file|create\s+file|write\s+file|delete\s+file)\b/i,
    /\b(inside\s+my\s+project|inside\s+the\s+project)\b/i,
    /\b(save\s+to\s+project|add\s+to\s+project|in\s+this\s+project)\b/i,
    /\b(index\.html|style\.css|script\.js|app\.py|main\.py|server\.js|package\.json)\b/i
  ];
  return patterns.some(p => p.test(q));
}

module.exports = {
  PROJECTS_ROOT,
  listProjects,
  createProject,
  getActiveProject,
  setActiveProject,
  listProjectFiles,
  readProjectFile,
  writeProjectFile,
  modifyProjectFile,
  deleteProjectFile,
  saveUploadedProjectFile,
  executeProjectCommand,
  executeProjectTool,
  PROJECT_TOOLS,
  getProjectDirective,
  isProjectTask,
  resolveProjectPath
};
