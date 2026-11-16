/**
 * DSH Plugin: Subprocess Sandbox Provider
 * Executes code snippets with hard watchdog timers and stdout/stderr capture.
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { SEAMS } = require('../seams');

const SandboxPlugin = {
  name: 'dsh-provider-sandbox',
  version: '1.2.0',
  category: 'Execution',
  description: 'Subprocess code execution sandbox for Python and Node.js with watchdog termination.',

  apply(ctx) {
    const sandboxDir = path.join(process.cwd(), 'workspace');
    if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true });

    const sandboxService = {
      async runCode({ language = 'python', code = '', timeoutMs = 6000 }) {
        if (!code.trim()) {
          return { ok: false, error: 'Empty code string provided' };
        }

        const lang = language.toLowerCase();
        const ext = (lang === 'python' || lang === 'py') ? 'py' : 'js';
        const tempFile = path.join(sandboxDir, `_dsh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`);
        fs.writeFileSync(tempFile, code, 'utf8');

        let cmd = '';
        let args = [tempFile];
        if (lang === 'python' || lang === 'py') cmd = 'python';
        else if (lang === 'javascript' || lang === 'js' || lang === 'node') cmd = 'node';
        else {
          try { fs.unlinkSync(tempFile); } catch (e) {}
          return { ok: false, error: `Unsupported language: ${language}` };
        }

        const t0 = Date.now();
        return new Promise(resolve => {
          let stdout = '';
          let stderr = '';
          let killed = false;

          const child = spawn(cmd, args, {
            cwd: sandboxDir,
            windowsHide: true,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
          });

          const timer = setTimeout(() => {
            killed = true;
            try { child.kill('SIGKILL'); } catch (e) {}
          }, timeoutMs);

          child.stdout.on('data', d => { if (stdout.length < 25000) stdout += d.toString(); });
          child.stderr.on('data', d => { if (stderr.length < 25000) stderr += d.toString(); });

          child.on('close', exitCode => {
            clearTimeout(timer);
            try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
            const dur = Date.now() - t0;
            resolve({
              ok: exitCode === 0 && !killed,
              success: exitCode === 0 && !killed,
              exitCode: exitCode ?? (killed ? 137 : 0),
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              duration_ms: dur,
              killed
            });
          });

          child.on('error', err => {
            clearTimeout(timer);
            try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
            resolve({ ok: false, success: false, error: err.message, duration_ms: Date.now() - t0 });
          });
        });
      }
    };

    SEAMS.SANDBOX.validateProvider(sandboxService);
    ctx.provide('sandbox', sandboxService);
  }
};

module.exports = SandboxPlugin;
