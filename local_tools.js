/**
 * AXOM Local System & File Execution Tools
 * Enables autonomous agentic file creation, folder management, and local execution.
 * Integrated with Universal File Generator (PDF, ZIP, TAR, HTML, JSON, CSV, Markdown, Binary).
 */

const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');
const universalFileGenerator = require('./universal_file_generator');

const USER_DESKTOP = universalFileGenerator.USER_DESKTOP;
const resolveSafePath = universalFileGenerator.resolveSafePath;

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
      description: 'Create or overwrite a file with specified text content on Desktop or workspace. Supports all text formats (HTML, JS, CSS, Python, Rust, Markdown, JSON, CSV, etc.) and provides a direct download link.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Target file path (e.g. "Desktop/Calculator/index.html" or "workspace/report.md").'
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
      name: 'generate_file',
      description: 'Generate any file format on Desktop or workspace: styled PDF documents, compressed ZIP/TAR archives, HTML web pages, code files, CSV, or binary files. Automatically creates parent directories and provides direct download cards.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Destination file path (e.g. "Desktop/document.pdf", "Desktop/bundle.zip", "Desktop/Calculator/index.html").'
          },
          file_type: {
            type: 'string',
            enum: ['pdf', 'zip', 'tar', 'html', 'json', 'csv', 'markdown', 'text', 'binary'],
            description: 'Type of file to generate.'
          },
          title: {
            type: 'string',
            description: 'Title for the document or report (especially for PDF generation).'
          },
          content: {
            type: 'string',
            description: 'Text or markdown content for the file.'
          },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' }
              }
            },
            description: 'List of files to pack inside an archive (for zip/tar).'
          }
        },
        required: ['file_path']
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
        relative_path: universalFileGenerator.getRelativeAlias(targetDir),
        message: `Successfully created folder at: ${targetDir}`
      };
    }

    if (toolName === 'write_file' || toolName === 'generate_file') {
      const targetPath = args.file_path || args.path || args.filename;
      const fileType = args.file_type;
      const content = args.content || '';
      const title = args.title;
      const files = args.files;
      const base64Data = args.base64_data || args.base64Data;
      const sourceDir = args.source_dir || args.sourceDir;

      const genResult = await universalFileGenerator.generateFile({
        filePath: targetPath,
        fileType,
        content,
        title,
        files,
        base64Data,
        sourceDir
      });

      return genResult;
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
        relative_path: universalFileGenerator.getRelativeAlias(targetPath),
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
