/**
 * DSH Plugin: Filesystem Service Provider
 * Provides seamless desktop, workspace, and file access to the agent.
 */

const fs = require('node:fs');
const path = require('node:path');
const { SEAMS } = require('../seams');

const USER_DESKTOP = path.join(process.env.USERPROFILE || 'C:\\Users\\abira', 'Desktop');

function resolvePath(target) {
  if (!target) return process.cwd();
  let clean = target.trim().replace(/^['"]|['"]$/g, '');
  if (/^(desktop[\/\\]|~\/desktop)/i.test(clean)) {
    clean = clean.replace(/^(desktop[\/\\]|~\/desktop[\/\\]?)/i, '');
    return path.join(USER_DESKTOP, clean);
  }
  return path.isAbsolute(clean) ? clean : path.join(process.cwd(), clean);
}

const FilesystemPlugin = {
  name: 'dsh-provider-filesystem',
  version: '1.2.0',
  category: 'Infrastructure',
  description: 'Desktop and workspace filesystem operations with automatic Desktop alias resolution.',

  apply(ctx) {
    const fsService = {
      resolvePath,

      async createFolder(folderPath) {
        const fullPath = resolvePath(folderPath);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
        return { success: true, path: fullPath, message: `Created directory: ${fullPath}` };
      },

      async writeFile(filePath, content) {
        const fullPath = resolvePath(filePath);
        const parent = path.dirname(fullPath);
        if (!fs.existsSync(parent)) {
          fs.mkdirSync(parent, { recursive: true });
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        return {
          success: true,
          path: fullPath,
          bytes: Buffer.byteLength(content, 'utf8'),
          message: `Wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${fullPath}`
        };
      },

      async readFile(filePath) {
        const fullPath = resolvePath(filePath);
        if (!fs.existsSync(fullPath)) {
          throw new Error(`File not found: ${fullPath}`);
        }
        return fs.readFileSync(fullPath, 'utf8');
      }
    };

    SEAMS.FILESYSTEM.validateProvider(fsService);
    ctx.provide('filesystem', fsService);
  }
};

module.exports = FilesystemPlugin;
