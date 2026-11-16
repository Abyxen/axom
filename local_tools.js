/**
 * AXOM Local System & File Execution Tools
 * Enables autonomous agentic file creation, folder management, and local execution.
 */

const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

const USER_DESKTOP = path.join(process.env.USERPROFILE || 'C:\\Users\\abira', 'Desktop');

function resolveSafePath(inputPath) {
  if (!inputPath) return process.cwd();
  let clean = inputPath.trim().replace(/^['"]|['"]$/g, '');

  if (/^(desktop[\/\\]|~\/desktop)/i.test(clean)) {
    clean = clean.replace(/^(desktop[\/\\]|~\/desktop[\/\\]?)/i, '');
    return path.join(USER_DESKTOP, clean);
  }

  if (path.isAbsolute(clean)) {
    return clean;
  }

  return path.join(process.cwd(), clean);
}

const LOCAL_SYSTEM_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_folder',
      description: 'Create a new directory on the user filesystem or Desktop. Use this when the user asks to create a folder on Desktop or workspace.',
      parameters: {
        type: 'object',
        properties: {
          folder_path: {
            type: 'string',
            description: 'Relative or absolute directory path (e.g. "Desktop/Calculator" or "workspace/project").'
          }
        },
        required: ['folder_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with specified text content on Desktop or workspace.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Target file path (e.g. "Desktop/Calculator/calculator.html").'
          },
          content: {
            type: 'string',
            description: 'Full text content to write into the file.'
          }
        },
        required: ['file_path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the text contents of a file on the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Target file path to read.'
          }
        },
        required: ['file_path']
      }
    }
  }
];

async function executeLocalTool(toolName, args = {}) {
  try {
    if (toolName === 'create_folder') {
      const targetDir = resolveSafePath(args.folder_path || args.path || args.dir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      return {
        success: true,
        action: 'create_folder',
        path: targetDir,
        message: `Successfully created folder at: ${targetDir}`
      };
    }

    if (toolName === 'write_file') {
      const targetPath = resolveSafePath(args.file_path || args.path || args.filename);
      const content = args.content || '';
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, content, 'utf8');
      return {
        success: true,
        action: 'write_file',
        path: targetPath,
        bytes: Buffer.byteLength(content, 'utf8'),
        message: `Successfully wrote file (${Buffer.byteLength(content, 'utf8')} bytes) at: ${targetPath}`
      };
    }

    if (toolName === 'read_file') {
      const targetPath = resolveSafePath(args.file_path || args.path);
      if (!fs.existsSync(targetPath)) {
        return { success: false, error: `File not found: ${targetPath}` };
      }
      const text = fs.readFileSync(targetPath, 'utf8');
      return {
        success: true,
        action: 'read_file',
        path: targetPath,
        content: text.length > 10000 ? text.slice(0, 10000) + '... [truncated]' : text
      };
    }

    return { success: false, error: `Unknown tool: ${toolName}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  LOCAL_SYSTEM_TOOLS,
  executeLocalTool,
  resolveSafePath
};
