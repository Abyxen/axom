/**
 * AXOM Universal File Generator Engine
 * Generates, compiles, and packages any file format (PDF, ZIP, TAR, HTML, JSON, CSV, Markdown, Binary).
 * Supports automatic Desktop/workspace alias resolution and provides ready-to-download URLs.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const USER_DESKTOP = path.join(process.env.USERPROFILE || 'C:\\Users\\abira', 'Desktop');
const WORKSPACE_DIR = process.cwd();

/**
 * Safely resolves target paths with Desktop and workspace aliases
 */
function resolveSafePath(inputPath) {
  if (!inputPath) return path.join(WORKSPACE_DIR, 'workspace', `file_${Date.now()}.txt`);
  let clean = inputPath.trim().replace(/^['"]|['"]$/g, '');

  if (/^(desktop[\/\\]|~\/desktop)/i.test(clean)) {
    clean = clean.replace(/^(desktop[\/\\]|~\/desktop[\/\\]?)/i, '');
    return path.join(USER_DESKTOP, clean);
  }

  if (/^(workspace[\/\\]|~\/workspace)/i.test(clean)) {
    clean = clean.replace(/^(workspace[\/\\]|~\/workspace[\/\\]?)/i, '');
    return path.join(WORKSPACE_DIR, 'workspace', clean);
  }

  if (path.isAbsolute(clean)) {
    return clean;
  }

  return path.join(WORKSPACE_DIR, clean);
}

/**
 * Converts an absolute path to a clean, user-facing relative alias
 */
function getRelativeAlias(fullPath) {
  if (!fullPath) return '';
  const norm = path.normalize(fullPath);
  const normDesktop = path.normalize(USER_DESKTOP);
  const normWorkspace = path.normalize(WORKSPACE_DIR);

  if (norm.toLowerCase().startsWith(normDesktop.toLowerCase())) {
    const rel = path.relative(normDesktop, norm);
    return `Desktop/${rel.replace(/\\/g, '/')}`;
  }
  if (norm.toLowerCase().startsWith(normWorkspace.toLowerCase())) {
    const rel = path.relative(normWorkspace, norm);
    return rel.replace(/\\/g, '/');
  }
  return norm;
}

/**
 * Detect MIME types for file serving & direct browser download
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.tgz': 'application/gzip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.py': 'text/x-python; charset=utf-8',
    '.rs': 'text/x-rust; charset=utf-8',
    '.sh': 'text/x-shellscript; charset=utf-8',
    '.ps1': 'text/plain; charset=utf-8'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Run a Python helper script safely using spawn
 */
function runPythonScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const pythonExe = process.env.PYTHON_PATH || 'python';
    const proc = spawn(pythonExe, [scriptPath, ...args], {
      windowsHide: true,
      cwd: WORKSPACE_DIR
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        reject(new Error(`Python script failed (${code}): ${stderr.trim() || stdout.trim()}`));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

/**
 * Core Universal File Generator
 */
async function generateFile({
  filePath,
  fileType,
  content = '',
  title,
  author = 'AXOM Intelligence',
  files = null,
  base64Data = null,
  sourceDir = null
}) {
  const targetPath = resolveSafePath(filePath);
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = path.extname(targetPath).toLowerCase();
  const effectiveType = (fileType || ext.replace(/^\./, '') || 'txt').toLowerCase();

  // 1. PDF Generation
  if (effectiveType === 'pdf' || ext === '.pdf') {
    const pdfScript = path.join(WORKSPACE_DIR, 'scripts', 'pdf_builder.py');
    const docTitle = title || path.basename(targetPath, path.extname(targetPath)).replace(/[-_]/g, ' ');
    
    // Write temp payload file to avoid PowerShell argument length & quote escaping limits
    const tempPayloadPath = path.join(WORKSPACE_DIR, 'workspace', `temp_pdf_${Date.now()}.json`);
    const payloadDir = path.dirname(tempPayloadPath);
    if (!fs.existsSync(payloadDir)) fs.mkdirSync(payloadDir, { recursive: true });

    fs.writeFileSync(tempPayloadPath, JSON.stringify({
      output: targetPath,
      title: docTitle,
      author: author || 'AXOM Intelligence',
      content: content || `# ${docTitle}\n\nGenerated by AXOM Intelligence Engine.`
    }), 'utf8');

    try {
      const res = await runPythonScript(pdfScript, ['--json', tempPayloadPath]);
      try { fs.unlinkSync(tempPayloadPath); } catch (_) {}
      
      const stats = fs.statSync(targetPath);
      const alias = getRelativeAlias(targetPath);
      return {
        success: true,
        action: 'generate_file',
        file_path: targetPath,
        relative_path: alias,
        file_name: path.basename(targetPath),
        file_type: 'pdf',
        size_bytes: stats.size,
        download_url: `/api/files/download?path=${encodeURIComponent(alias)}`,
        message: `Successfully generated PDF document (${stats.size} bytes) at: ${alias}`
      };
    } catch (err) {
      try { fs.unlinkSync(tempPayloadPath); } catch (_) {}
      throw err;
    }
  }

  // 2. Archive Generation (ZIP, TAR, TAR.GZ, RAR)
  if (['zip', 'tar', 'tgz', 'gz', 'rar'].includes(effectiveType) || ['.zip', '.tar', '.tgz', '.tar.gz', '.rar'].includes(ext)) {
    const archiveScript = path.join(WORKSPACE_DIR, 'scripts', 'archive_builder.py');
    let archiveTargetPath = targetPath;
    if (ext === '.rar') {
      // Create universal zip with appropriate archive format for cross-platform compatibility
      archiveTargetPath = targetPath.replace(/\.rar$/i, '.zip');
    }

    const tempJsonPath = path.join(WORKSPACE_DIR, 'workspace', `temp_archive_${Date.now()}.json`);
    const payloadDir = path.dirname(tempJsonPath);
    if (!fs.existsSync(payloadDir)) fs.mkdirSync(payloadDir, { recursive: true });

    let args = ['--output', archiveTargetPath];

    if (sourceDir && fs.existsSync(sourceDir)) {
      args.push('--source-dir', sourceDir);
    } else {
      let entries = [];
      if (Array.isArray(files) && files.length > 0) {
        entries = files;
      } else if (content) {
        entries = [{
          path: 'content.txt',
          content: content
        }];
      } else {
        entries = [{
          path: 'README.txt',
          content: 'Created by AXOM Archive Engine'
        }];
      }
      fs.writeFileSync(tempJsonPath, JSON.stringify(entries), 'utf8');
      args.push('--json', tempJsonPath);
    }

    try {
      await runPythonScript(archiveScript, args);
      try { if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath); } catch (_) {}

      const stats = fs.statSync(archiveTargetPath);
      const alias = getRelativeAlias(archiveTargetPath);
      return {
        success: true,
        action: 'generate_file',
        file_path: archiveTargetPath,
        relative_path: alias,
        file_name: path.basename(archiveTargetPath),
        file_type: 'zip',
        size_bytes: stats.size,
        download_url: `/api/files/download?path=${encodeURIComponent(alias)}`,
        message: `Successfully generated archive (${stats.size} bytes) at: ${alias}`
      };
    } catch (err) {
      try { if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath); } catch (_) {}
      throw err;
    }
  }

  // 3. Binary / Base64 Data
  if (base64Data) {
    const buf = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(targetPath, buf);
    const stats = fs.statSync(targetPath);
    const alias = getRelativeAlias(targetPath);
    return {
      success: true,
      action: 'generate_file',
      file_path: targetPath,
      relative_path: alias,
      file_name: path.basename(targetPath),
      file_type: effectiveType,
      size_bytes: stats.size,
      download_url: `/api/files/download?path=${encodeURIComponent(alias)}`,
      message: `Successfully written binary file (${stats.size} bytes) at: ${alias}`
    };
  }

  // 4. Standard Text, HTML, Code, Markdown, CSV, JSON
  fs.writeFileSync(targetPath, content || '', 'utf8');
  const stats = fs.statSync(targetPath);
  const alias = getRelativeAlias(targetPath);

  return {
    success: true,
    action: 'write_file',
    file_path: targetPath,
    relative_path: alias,
    file_name: path.basename(targetPath),
    file_type: effectiveType,
    size_bytes: stats.size,
    download_url: `/api/files/download?path=${encodeURIComponent(alias)}`,
    message: `Successfully generated file (${stats.size} bytes) at: ${alias}`
  };
}

module.exports = {
  resolveSafePath,
  getRelativeAlias,
  getMimeType,
  generateFile,
  USER_DESKTOP,
  WORKSPACE_DIR
};
