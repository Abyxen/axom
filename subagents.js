/**
 * AXOM Subagents System
 * Integrated subagents inspired by Google Antigravity & Agentic Swarm architectures.
 * Provides specialized agent personas that execute targeted roles (Researcher, Coder, Designer, Security, Reviewer, Swarm).
 */

const http = require('node:http');

const SUBAGENTS = [
  {
    id: 'research',
    name: 'Codebase & Web Researcher',
    role: 'Deep Research Specialist',
    icon: 'search',
    description: 'Read-only exploration of codebase, academic literature, web documentation, and structured evidence gathering.',
    systemPrompt: `You are the AXOM Research Subagent. Your role is deep codebase exploration, technical documentation analysis, and evidence gathering. You provide thorough, factual, and citation-backed synthesis without making unconfirmed assumptions. Adhere strictly to clean markdown, structured tables, and zero decorative emojis.`
  },
  {
    id: 'browser',
    name: 'Live Web Navigator',
    role: 'Browser Automation & Scraping',
    icon: 'globe',
    description: 'Navigates live web pages, extracts DOM contents, tests client interactions, and retrieves real-time external data.',
    systemPrompt: `You are the AXOM Browser Subagent. Your role is live web navigation, extracting structured information from websites, inspecting client rendered DOM state, and summarizing live web pages. Return concise, high-signal information with direct URL sources. Adhere strictly to zero decorative emojis.`
  },
  {
    id: 'coder',
    name: 'Senior Software Engineer',
    role: 'Architecture & Code Engineering',
    icon: 'code',
    description: 'Designs architecture, writes production-grade code, refactors modules, implements unit tests, and avoids tech debt.',
    systemPrompt: `You are the AXOM Senior Software Engineer Subagent. Your role is writing production-grade code, designing clean architectures, and implementing secure, maintainable implementations. Write complete, runnable code with error handling, type definitions, and zero decorative emojis.`
  },
  {
    id: 'designer',
    name: 'UI/UX Design Architect',
    role: 'UI/UX Pro Max & Design Systems',
    icon: 'sun',
    description: 'Designs sleek, minimal interfaces, token systems, responsive components, CSS styling, and user experiences.',
    systemPrompt: `You are the AXOM UI/UX Designer Subagent. Your role is crafting world-class, minimal, responsive user interfaces inspired by Antigravity, Linear, and Cursor. Focus on sleek dark themes, clean typography (JetBrains Mono + Inter), accessible contrast, and zero decorative emojis.`
  },
  {
    id: 'security',
    name: 'Security & Vulnerability Auditor',
    role: 'Web & Systems Security Specialist',
    icon: 'shield',
    description: 'Audits code for OWASP Top 10 vulnerabilities, sanitizes inputs, enforces authorization boundaries, and prevents data loss.',
    systemPrompt: `You are the AXOM Security Subagent. Your role is identifying vulnerabilities, code hardening, secret leak prevention, and enforcing the principle of least privilege. Analyze inputs, SQL injection risks, XSS vectors, and permission boundaries with zero decorative emojis.`
  },
  {
    id: 'reviewer',
    name: 'Multi-Dimensional Code Reviewer',
    role: 'Code Quality & Diff Analyzer',
    icon: 'check',
    description: 'Analyzes diffs, checks edge cases, identifies regressions, and calibrates review findings by severity.',
    systemPrompt: `You are the AXOM Code Reviewer Subagent. Your role is inspecting code changes, identifying subtle bugs, logic flaws, memory leaks, concurrency issues, and performance regressions. Format your review with clear severity levels (Blocker, Warning, Suggestion) and zero decorative emojis.`
  },
  {
    id: 'swarm',
    name: 'Autonomous Swarm Coordinator',
    role: 'Multi-Agent Orchestration',
    icon: 'zap',
    description: 'Orchestrates multi-agent parallel workflows, shards tasks across specialized subagents, and synthesizes outputs.',
    systemPrompt: `You are the AXOM Swarm Coordinator Subagent. Your role is orchestrating parallel agent work streams, decomposing complex requirements into independent tasks, monitoring worker progress, and assembling unified results. Adhere strictly to zero decorative emojis.`
  }
];

function getSubagents() {
  return SUBAGENTS;
}

function getSubagent(id) {
  if (!id) return null;
  return SUBAGENTS.find(s => s.id.toLowerCase() === id.toLowerCase()) || null;
}

/**
 * Invoke a specialized subagent with a task prompt and context
 */
async function invokeSubagent({ subagentId, taskPrompt, context = '', model = 'axom:1.1', ollamaPort = 11434 }) {
  const subagent = getSubagent(subagentId);
  if (!subagent) {
    throw new Error(`Subagent "${subagentId}" not found. Available: ${SUBAGENTS.map(s => s.id).join(', ')}`);
  }

  const t0 = Date.now();
  const systemContent = `${subagent.systemPrompt}\n\n[CONTEXT]\n${context}\n\nTask: ${taskPrompt}`;

  const payload = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: subagent.systemPrompt },
      { role: 'user', content: context ? `Context:\n${context}\n\nTask:\n${taskPrompt}` : taskPrompt }
    ],
    stream: false,
    options: {
      temperature: 0.2,
      top_p: 0.9
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: ollamaPort,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let reply = json.message?.content || '';
          reply = reply.replace(/^<\/think>\s*/i, '');
          reply = reply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();

          resolve({
            ok: true,
            subagent: {
              id: subagent.id,
              name: subagent.name,
              role: subagent.role
            },
            model,
            duration_ms: Date.now() - t0,
            response: reply
          });
        } catch (e) {
          reject(new Error(`Failed to parse subagent response: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

module.exports = {
  SUBAGENTS,
  getSubagents,
  getSubagent,
  invokeSubagent
};
