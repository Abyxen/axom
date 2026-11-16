/**
 * AXOM Universal Skills & Plugin Hub
 * Integrates industry-grade skills from AMD, Shokunin, Wshobson Agents, and Agentic-Awesome-Skills.
 * Enables the local neural model (RTX 5060 axom:1.1) to dynamically consult and execute specialized skills.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, 'skills');

let indexedSkills = new Map();
let lastIndexedTime = 0;

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const rawMeta = match[1];
  const body = match[2].trim();
  const meta = {};

  for (const line of rawMeta.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      let val = trimmed.slice(colonIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
  }

  return { meta, body };
}

function indexSkills(force = false) {
  const now = Date.now();
  if (!force && indexedSkills.size > 0 && now - lastIndexedTime < 300000) {
    return Array.from(indexedSkills.values());
  }

  if (!fs.existsSync(SKILLS_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  indexedSkills.clear();

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        try {
          const raw = fs.readFileSync(skillFile, 'utf8');
          const { meta, body } = parseFrontmatter(raw);

          const skillObj = {
            id: entry.name,
            name: meta.name || entry.name,
            description: meta.description || 'Specialized agentic engineering skill',
            version: meta.version || '1.0.0',
            category: meta.category || determineCategory(entry.name),
            author: meta.author || meta.source || 'Curated',
            rawLength: raw.length,
            content: body,
            filePath: skillFile
          };

          indexedSkills.set(entry.name.toLowerCase(), skillObj);
        } catch (e) {
          console.warn(`[SKILLS] Failed to index skill ${entry.name}:`, e.message);
        }
      }
    }
  }

  lastIndexedTime = now;
  return Array.from(indexedSkills.values());
}

function determineCategory(name) {
  if (name.includes('ai') || name.includes('workload')) return 'Hardware & Local AI';
  if (name.includes('code') || name.includes('coding')) return 'Code Quality';
  if (name.includes('db') || name.includes('database')) return 'Database & Systems';
  if (name.includes('security') || name.includes('auth') || name.includes('mcp')) return 'Security & Auth';
  if (name.includes('team') || name.includes('agent') || name.includes('parallel')) return 'Multi-Agent Teams';
  if (name.includes('error') || name.includes('debug')) return 'Debugging & Reliability';
  if (name.includes('test') || name.includes('playwright')) return 'Testing & QA';
  if (name.includes('optimizer') || name.includes('perf')) return 'Performance';
  return 'Engineering Craftsmanship';
}

function getSkillsCatalog() {
  const skills = indexSkills();
  return skills.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    sizeBytes: s.rawLength
  }));
}

function getSkill(skillId) {
  if (!skillId) return null;
  indexSkills();
  const cleanId = String(skillId).toLowerCase().trim();
  if (indexedSkills.has(cleanId)) {
    return indexedSkills.get(cleanId);
  }
  // Fallback fuzzy search
  for (const [id, skill] of indexedSkills.entries()) {
    if (id.includes(cleanId) || cleanId.includes(id)) {
      return skill;
    }
  }
  return null;
}

function findRelevantSkills(prompt) {
  if (!prompt || typeof prompt !== 'string') return [];
  const lower = prompt.toLowerCase();
  indexSkills();

  const matches = [];
  for (const skill of indexedSkills.values()) {
    const id = skill.id.toLowerCase();
    const name = skill.name.toLowerCase();
    const desc = skill.description.toLowerCase();

    // Check direct mention
    if (lower.includes(id) || lower.includes(name)) {
      matches.push({ skill, score: 10 });
      continue;
    }

    // Heuristics
    let score = 0;
    if (id === 'efficient-coding' && /\b(code|write|function|script|refactor)\b/.test(lower)) score += 3;
    if (id === 'error-handler' && /\b(error|bug|exception|crash|failed|issue)\b/.test(lower)) score += 3;
    if (id === 'db-sculptor' && /\b(database|sql|sqlite|schema|query|table)\b/.test(lower)) score += 3;
    if (id === 'web-security' && /\b(security|vulnerability|xss|injection|owasp|auth)\b/.test(lower)) score += 3;
    if (id === 'performance-profiler' && /\b(performance|slow|latency|speed|optimize|bottleneck)\b/.test(lower)) score += 3;
    if (id === 'local-ai-use' && /\b(local|ollama|gpu|vram|rtx 5060|offline)\b/.test(lower)) score += 3;
    if (id === 'test-commander' && /\b(test|unit test|jest|pytest|qa|assert)\b/.test(lower)) score += 3;

    if (score > 0) {
      matches.push({ skill, score });
    }
  }

  return matches.sort((a, b) => b.score - a.score).map(m => m.skill).slice(0, 3);
}

/**
 * Tool Definition for Ollama and Cloud Models
 */
const SKILL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consult_skill',
      description: 'Consult the installed craftsmanship engineering and local AI skill library (e.g. efficient-coding, db-sculptor, local-ai-use, web-security, performance-profiler, error-handler) to ground the answer in professional standards.',
      parameters: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            description: 'Name or ID of the skill to consult (e.g. "efficient-coding", "db-sculptor", "local-ai-use", "error-handler", "web-security", "test-commander")'
          }
        },
        required: ['skill_name']
      }
    }
  }
];

function executeSkillConsultation(skillName) {
  const skill = getSkill(skillName);
  if (!skill) {
    const catalog = getSkillsCatalog().map(s => s.id).slice(0, 10).join(', ');
    return {
      status: 'error',
      message: `Skill "${skillName}" not found. Available skills include: ${catalog}...`
    };
  }

  // Provide high-density excerpt of the skill instructions (first 2500 chars)
  const truncatedContent = skill.content.slice(0, 3000);
  return {
    status: 'success',
    skill_id: skill.id,
    skill_name: skill.name,
    category: skill.category,
    guidelines: truncatedContent
  };
}

module.exports = {
  SKILLS_DIR,
  indexSkills,
  getSkillsCatalog,
  getSkill,
  findRelevantSkills,
  SKILL_TOOLS,
  executeSkillConsultation
};
