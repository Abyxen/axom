/**
 * DSH Plugin: Filesystem Service Provider
 * Provides seamless desktop, workspace, and file access to the agent.
 * Integrated with Universal File Generator for multi-format downloads.
 */

const fs = require('node:fs');
const path = require('node:path');
const { SEAMS } = require('../seams');
const universalFileGenerator = require('../../universal_file_generator');

const USER_DESKTOP = universalFileGenerator.USER_DESKTOP;
const resolvePath = universalFileGenerator.resolveSafePath;

const FilesystemPlugin = {
  name: 'dsh-provider-filesystem',
  version: '1.3.0',
  category: 'Infrastructure',
  description: 'Desktop and workspace filesystem operations with automatic Desktop alias resolution and universal generation.',

  apply(ctx) {
    const fsService = {
      resolvePath,

      async createFolder(folderPath) {
        const fullPath = resolvePath(folderPath);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
        return {
          success: true,
          path: fullPath,
          relative_path: universalFileGenerator.getRelativeAlias(fullPath),
          message: `Created directory: ${fullPath}`
        };
      },

      async writeFile(filePath, content) {
        return await universalFileGenerator.generateFile({
          filePath,
          content
        });
      },

      async generateFile(options) {
        return await universalFileGenerator.generateFile(options);
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
