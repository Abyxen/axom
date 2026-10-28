const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

const BASE_WORKSPACE_DIR = path.join(__dirname, 'workspace');

// Ensure base workspace folder exists
if (!fs.existsSync(BASE_WORKSPACE_DIR)) {
  fs.mkdirSync(BASE_WORKSPACE_DIR, { recursive: true });
}

// System paths that can NEVER be touched under any circumstances
const FORBIDDEN_SYSTEM_PATHS = [
  'windows',
  'system32',
  'program files',
  'program files (x86)',
  'appdata\\local\\microsoft',
  '$recycle.bin'
];

// Dangerous terminal commands blocked by default
const FORBIDDEN_COMMAND_PATTERNS = [
  /format\s+[a-z]:/i,
  /del\s+\/[a-z\s]*c:\\/i,
  /rmdir\s+\/[a-z\s]*c:\\/i,
  /rd\s+\/[a-z\s]*c:\\/i,
  /diskpart/i,
  /bcdedit/i,
  /reg\s+delete/i,
  /shutdown/i
];

/**
 * Custom error for security boundary violations
 */
class SandboxSecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SandboxSecurityError';
  }
}

/**
 * Validate that a target path stays strictly inside the designated workspace directory
 */
function resolveSafePath(userPath, workspaceRoot) {
  if (!workspaceRoot) {
    throw new SandboxSecurityError('No workspace directory configured for this project.');
  }

  const normalizedWorkspace = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(normalizedWorkspace, userPath || '');

  // 1. Path Traversal Guard: Target must be inside or equal to workspace directory
  const relative = path.relative(normalizedWorkspace, resolvedTarget);
  const isInside = !relative.startsWith('..') && !path.isAbsolute(relative);

  if (!isInside && resolvedTarget.toLowerCase() !== normalizedWorkspace.toLowerCase()) {
    throw new SandboxSecurityError(
      `Permission Denied: Path "${userPath}" is outside the permitted workspace directory "${normalizedWorkspace}".`
    );
  }

  // 2. Critical System Directory Guard
  const lower = resolvedTarget.toLowerCase();
  for (const sys of FORBIDDEN_SYSTEM_PATHS) {
    if (lower.includes(sys)) {
      throw new SandboxSecurityError(`Permission Denied: Access to system directory containing "${sys}" is strictly forbidden.`);
    }
  }

  return resolvedTarget;
}

/**
 * Read file contents safely
 */
async function safeReadFile(relPath, workspaceRoot) {
  const safePath = resolveSafePath(relPath, workspaceRoot);
  if (!fs.existsSync(safePath)) {
    throw new Error(`File not found: ${relPath}`);
  }
  const stat = fs.statSync(safePath);
  if (!stat.isFile()) {
    throw new Error(`Path is a directory, not a file: ${relPath}`);
  }
  return fs.readFileSync(safePath, 'utf8');
}

/**
 * Write file contents safely (creates parent directories if needed)
 */
async function safeWriteFile(relPath, content, workspaceRoot) {
  const safePath = resolveSafePath(relPath, workspaceRoot);
  const parent = path.dirname(safePath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(safePath, content, 'utf8');
  return { path: relPath, size: Buffer.byteLength(content, 'utf8'), status: 'created_or_updated' };
}

/**
 * Edit existing file safely (single find and replace)
 */
async function safeEditFile(relPath, target, replacement, workspaceRoot) {
  const safePath = resolveSafePath(relPath, workspaceRoot);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Cannot edit file: "${relPath}" does not exist.`);
  }
  const original = fs.readFileSync(safePath, 'utf8');
  if (!original.includes(target)) {
    throw new Error(`Target text to replace not found in "${relPath}".`);
  }
  const updated = original.replace(target, replacement);
  fs.writeFileSync(safePath, updated, 'utf8');
  return { path: relPath, status: 'edited' };
}

/**
 * Delete file safely
 */
async function safeDeleteFile(relPath, workspaceRoot) {
  const safePath = resolveSafePath(relPath, workspaceRoot);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Cannot delete: "${relPath}" does not exist.`);
  }
  const stat = fs.statSync(safePath);
  if (stat.isDirectory()) {
    fs.rmSync(safePath, { recursive: true, force: true });
    return { path: relPath, type: 'directory', status: 'deleted' };
  } else {
    fs.unlinkSync(safePath);
    return { path: relPath, type: 'file', status: 'deleted' };
  }
}

/**
 * List files and subdirectories in a safe workspace folder
 */
async function safeListDirectory(relPath = '', workspaceRoot) {
  const safePath = resolveSafePath(relPath, workspaceRoot);
  if (!fs.existsSync(safePath)) {
    throw new Error(`Directory not found: "${relPath}"`);
  }
  const entries = fs.readdirSync(safePath, { withFileTypes: true });
  return entries.map(e => ({
    name: e.name,
    type: e.isDirectory() ? 'directory' : 'file',
    path: path.join(relPath, e.name).replace(/\\/g, '/')
  }));
}

/**
 * Run safe terminal command in workspace directory
 */
function safeRunTerminalCommand(command, workspaceRoot, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (!workspaceRoot || !fs.existsSync(workspaceRoot)) {
      return reject(new SandboxSecurityError('Workspace directory does not exist.'));
    }

    // Check for dangerous shell patterns
    for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
      if (pattern.test(command)) {
        return reject(new SandboxSecurityError(`Command blocked by security policy: matches forbidden pattern "${pattern}".`));
      }
    }

    const env = { ...process.env, AXOM_WORKSPACE: workspaceRoot };
    exec(command, { cwd: workspaceRoot, timeout: timeoutMs, env, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({
        command,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: err ? (err.code ?? 1) : 0,
        timedOut: err?.killed || false
      });
    });
  });
}

/**
 * Get or create project workspace folder
 */
function getOrCreateWorkspace(projectName = 'default') {
  const sanitized = projectName.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_') || 'default';
  const projectDir = path.join(BASE_WORKSPACE_DIR, sanitized);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  return projectDir;
}

/**
 * List all existing workspaces
 */
function listWorkspaces() {
  if (!fs.existsSync(BASE_WORKSPACE_DIR)) return ['default'];
  const dirs = fs.readdirSync(BASE_WORKSPACE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  return dirs.length ? dirs : ['default'];
}

module.exports = {
  BASE_WORKSPACE_DIR,
  SandboxSecurityError,
  resolveSafePath,
  safeReadFile,
  safeWriteFile,
  safeEditFile,
  safeDeleteFile,
  safeListDirectory,
  safeRunTerminalCommand,
  getOrCreateWorkspace,
  listWorkspaces
};
