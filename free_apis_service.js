/**
 * free_apis_service.js
 * Comprehensive integration of Awesome Free LLM APIs (https://github.com/mnfst/awesome-free-llm-apis)
 * Provides permanent free LLM directory, zero-key free routes, verification testing, code generation,
 * and real-time usage telemetry & rate-limit management.
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data', 'free_llm_apis.json');
const KEYS_PATH = path.join(__dirname, 'data', 'ai_keys.json');
const USAGE_PATH = path.join(__dirname, 'data', 'provider_usage.json');

// Provider rate limits from awesome-free-llm-apis repository
const PROVIDER_LIMITS = {
  gemini:      { maxRequests: 1500, period: 'day', label: '1,500 req/day' },
  groq:        { maxRequests: 1000, period: 'day', label: '1,000 req/day' },
  openrouter:  { maxRequests: 50,   period: 'day', label: '50 req/day' },
  kilo:        { maxRequests: 200,  period: 'hour', label: '200 req/hr (keyless)' },
  cohere:      { maxRequests: 1000, period: 'month', label: '1,000 req/mo' },
  aion:        { maxRequests: 100,  period: 'day', label: '20K tok/day · 15 RPM' },
  cloudflare:  { maxRequests: 500,  period: 'day', label: '10K neurons/day' },
  llm7:        { maxRequests: 250,  period: 'hour', label: '250 req/hr · 60 RPM' },
  ovhcloud:    { maxRequests: 120,  period: 'hour', label: '2 req/min' },
  nvidia:      { maxRequests: 1000, period: 'day', label: 'NVIDIA Dev quota' },
  zai:         { maxRequests: 200,  period: 'day', label: '1 concurrent req' },
  gonka:       { maxRequests: 1000, period: 'month', label: '~1M tok/mo' },
  modelscope:  { maxRequests: 2000, period: 'day', label: '2,000 req/day' },
  siliconflow: { maxRequests: 500,  period: 'day', label: 'Free tier quota' },
  local:       { maxRequests: 0,    period: 'unlimited', label: 'Unlimited (RTX 5060)' }
};

// Provider ID and operational metadata lookup table
const PROVIDER_METADATA_MAP = {
  'aion labs': {
    id: 'aion',
    env: 'AION_API_KEY',
    openaiBaseUrl: 'https://api.aionlabs.ai/v1',
    priorities: ['reasoning'],
    keyPrefix: 'aion_'
  },
  'cohere': {
    id: 'cohere',
    env: 'COHERE_API_KEY',
    openaiBaseUrl: 'https://api.cohere.ai/compatibility/v1',
    priorities: ['proprietary', 'code', 'reasoning'],
    keyPrefix: 'co_'
  },
  'google gemini': {
    id: 'gemini',
    env: 'GEMINI_API_KEY',
    openaiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    priorities: ['large_context', 'proprietary', 'multimodal'],
    keyPrefix: 'AIzaSy'
  },
  'z ai (zhipu ai)': {
    id: 'zai',
    env: 'ZAI_API_KEY',
    openaiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    priorities: ['reasoning', 'large_context'],
    keyPrefix: ''
  },
  'cloudflare workers ai': {
    id: 'cloudflare',
    env: 'CF_API_TOKEN',
    extraEnv: { CF_ACCOUNT_ID: 'your-account-id' },
    openaiBaseUrl: 'https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1',
    priorities: ['selection', 'multimodal'],
    keyPrefix: ''
  },
  'gonka broker': {
    id: 'gonka',
    env: 'GONKA_API_KEY',
    openaiBaseUrl: 'https://proxy.gonkabroker.com/v1',
    priorities: ['reasoning', 'large_context'],
    keyPrefix: ''
  },
  'groq': {
    id: 'groq',
    env: 'GROQ_API_KEY',
    openaiBaseUrl: 'https://api.groq.com/openai/v1',
    priorities: ['fastest'],
    keyPrefix: 'gsk_'
  },
  'kilo code': {
    id: 'kilo',
    env: 'KILO_API_KEY',
    keyless: true,
    anonymousKey: 'anonymous',
    openaiBaseUrl: 'https://api.kilo.ai/api/gateway',
    priorities: ['keyless', 'code', 'large_context', 'frontier'],
    keyPrefix: ''
  },
  'llm7.io': {
    id: 'llm7',
    env: 'LLM7_API_KEY',
    keyless: true,
    openaiBaseUrl: 'https://api.llm7.io/v1',
    priorities: ['keyless', 'eu'],
    keyPrefix: ''
  },
  'modelscope': {
    id: 'modelscope',
    env: 'MODELSCOPE_API_KEY',
    openaiBaseUrl: 'https://api-inference.modelscope.cn/v1',
    priorities: ['selection'],
    keyPrefix: ''
  },
  'nvidia nim': {
    id: 'nvidia',
    env: 'NVIDIA_API_KEY',
    openaiBaseUrl: 'https://integrate.api.nvidia.com/v1',
    priorities: ['selection', 'frontier', 'large_context'],
    keyPrefix: 'nvapi-'
  },
  'openrouter': {
    id: 'openrouter',
    env: 'OPENROUTER_API_KEY',
    openaiBaseUrl: 'https://openrouter.ai/api/v1',
    priorities: ['frontier', 'code', 'reasoning', 'large_context'],
    keyPrefix: 'sk-or-v1-'
  },
  'ovhcloud ai endpoints': {
    id: 'ovhcloud',
    env: 'OVH_API_KEY',
    keyless: true,
    noBearer: true,
    openaiBaseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
    priorities: ['keyless', 'eu'],
    keyPrefix: ''
  },
  'siliconflow': {
    id: 'siliconflow',
    env: 'SILICONFLOW_API_KEY',
    openaiBaseUrl: 'https://api.siliconflow.cn/v1',
    priorities: ['frontier'],
    keyPrefix: 'sk-'
  }
};

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function loadUsageData() {
  const today = getTodayString();
  const defaultUsage = {
    date: today,
    providers: {}
  };

  try {
    if (fs.existsSync(USAGE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8'));
      if (parsed.date !== today) {
        // Roll over to new day: keep total stats and history, reset daily counters
        const rolledProviders = {};
        for (const [pId, pData] of Object.entries(parsed.providers || {})) {
          rolledProviders[pId] = {
            ...pData,
            requestsToday: 0,
            tokensToday: 0,
            yesterdayRequests: pData.requestsToday || 0
          };
        }
        const updated = { date: today, providers: rolledProviders };
        saveUsageData(updated);
        return updated;
      }
      return parsed;
    }
  } catch (e) {
    console.warn('[FREE_APIS] Usage read warning:', e.message);
  }

  saveUsageData(defaultUsage);
  return defaultUsage;
}

function saveUsageData(data) {
  try {
    const dir = path.dirname(USAGE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[FREE_APIS] Usage save error:', e.message);
  }
}

/**
 * Record usage whenever an AI chat turn completes
 */
function recordUsage({ providerId = 'local', modelId = '', promptTokens = 0, completionTokens = 0, latencyMs = 0 }) {
  const pId = providerId.toLowerCase();
  const usage = loadUsageData();
  if (!usage.providers[pId]) {
    usage.providers[pId] = {
      requestsToday: 0,
      requestsTotal: 0,
      tokensToday: 0,
      tokensTotal: 0,
      avgLatencyMs: 0,
      lastUsed: null,
      lastModel: null
    };
  }

  const pStats = usage.providers[pId];
  pStats.requestsToday = (pStats.requestsToday || 0) + 1;
  pStats.requestsTotal = (pStats.requestsTotal || 0) + 1;

  const totalToks = (promptTokens || 0) + (completionTokens || 0);
  pStats.tokensToday = (pStats.tokensToday || 0) + totalToks;
  pStats.tokensTotal = (pStats.tokensTotal || 0) + totalToks;

  pStats.lastUsed = new Date().toISOString();
  pStats.lastModel = modelId || pStats.lastModel;

  if (latencyMs > 0) {
    const prevCount = pStats.requestsToday - 1;
    const prevAvg = pStats.avgLatencyMs || latencyMs;
    pStats.avgLatencyMs = prevCount > 0 ? Math.round((prevAvg * prevCount + latencyMs) / pStats.requestsToday) : latencyMs;
  }

  saveUsageData(usage);
  return pStats;
}

/**
 * Get enriched usage statistics with progress metrics
 */
function getUsageStats() {
  const usage = loadUsageData();
  const result = {
    date: usage.date,
    totalRequestsToday: 0,
    totalTokensToday: 0,
    providers: {}
  };

  for (const [pId, pLimit] of Object.entries(PROVIDER_LIMITS)) {
    const pData = usage.providers[pId] || {
      requestsToday: 0,
      requestsTotal: 0,
      tokensToday: 0,
      tokensTotal: 0,
      avgLatencyMs: 0,
      lastUsed: null
    };

    result.totalRequestsToday += pData.requestsToday || 0;
    result.totalTokensToday += pData.tokensToday || 0;

    const maxReq = pLimit.maxRequests;
    const reqToday = pData.requestsToday || 0;
    const percentUsed = maxReq > 0 ? Math.min(100, Math.round((reqToday / maxReq) * 100)) : 0;
    const remaining = maxReq > 0 ? Math.max(0, maxReq - reqToday) : 'Unlimited';

    result.providers[pId] = {
      id: pId,
      requestsToday: reqToday,
      requestsTotal: pData.requestsTotal || 0,
      tokensToday: pData.tokensToday || 0,
      tokensTotal: pData.tokensTotal || 0,
      maxRequests: maxReq,
      percentUsed,
      remaining,
      quotaLabel: pLimit.label,
      period: pLimit.period,
      avgLatencyMs: pData.avgLatencyMs || 0,
      lastUsed: pData.lastUsed
    };
  }

  return result;
}

function loadStoredKeys() {
  try {
    if (fs.existsSync(KEYS_PATH)) {
      return JSON.parse(fs.readFileSync(KEYS_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[FREE_APIS] Keys read error:', e.message);
  }
  return {};
}

function getRawData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[FREE_APIS] Data read error:', e.message);
  }
  return { providers: [], glossary: [], footnotes: {} };
}

/**
 * Returns enriched catalog of all free providers, models, and live usage metrics
 */
function getCatalog() {
  const raw = getRawData();
  const storedKeys = loadStoredKeys();
  const usageStats = getUsageStats();

  const providers = (raw.providers || []).map(p => {
    const keyName = (p.name || '').toLowerCase().trim();
    const meta = PROVIDER_METADATA_MAP[keyName] || {
      id: keyName.replace(/[^a-z0-9]/g, '_'),
      env: `${keyName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`,
      openaiBaseUrl: p.baseUrl,
      priorities: []
    };

    const provId = meta.id;
    const hasKey = Boolean((storedKeys.keys && storedKeys.keys[provId]) || storedKeys[provId] || process.env[meta.env]);
    const isKeyless = Boolean(meta.keyless);
    const usage = usageStats.providers[provId] || {
      requestsToday: 0,
      maxRequests: 0,
      percentUsed: 0,
      remaining: 'Unlimited',
      quotaLabel: 'Free Tier',
      avgLatencyMs: 0
    };

    return {
      id: provId,
      name: p.name,
      flag: p.flag,
      country: p.country,
      category: p.category, // 'provider_api' | 'inference_provider'
      description: p.description,
      baseUrl: p.baseUrl,
      openaiBaseUrl: meta.openaiBaseUrl || p.baseUrl,
      keyUrl: p.url,
      envVar: meta.env,
      keyless: isKeyless,
      noBearer: Boolean(meta.noBearer),
      anonymousKey: meta.anonymousKey || '',
      priorities: meta.priorities || [],
      isConfigured: hasKey || isKeyless,
      hasKey,
      keyPrefix: meta.keyPrefix || '',
      usage,
      models: (p.models || []).map(m => {
        const isReasoning = (m.modality || '').toLowerCase().includes('reasoning');
        const isCode = (m.modality || '').toLowerCase().includes('code');
        const isMultimodal = (m.modality || '').toLowerCase().includes('image') || (m.modality || '').toLowerCase().includes('video') || (m.modality || '').toLowerCase().includes('multimodal');
        const isLargeCtx = m.context && (m.context.includes('1M') || m.context.includes('512K') || m.context.includes('400K') || m.context.includes('262K') || m.context.includes('256K'));

        const modelPriorities = [];
        if (isReasoning) modelPriorities.push('reasoning');
        if (isCode) modelPriorities.push('code');
        if (isMultimodal) modelPriorities.push('multimodal');
        if (isLargeCtx) modelPriorities.push('large_context');
        if (isKeyless) modelPriorities.push('keyless');

        return {
          id: m.id || m.name,
          name: m.name,
          context: m.context,
          maxOutput: m.maxOutput,
          modality: m.modality,
          rateLimit: m.rateLimit,
          priorities: modelPriorities
        };
      })
    };
  });

  return {
    lastUpdated: raw.lastUpdated,
    totalProviders: providers.length,
    totalModels: providers.reduce((acc, p) => acc + p.models.length, 0),
    keylessProviders: providers.filter(p => p.keyless).length,
    totalRequestsToday: usageStats.totalRequestsToday,
    totalTokensToday: usageStats.totalTokensToday,
    providers,
    glossary: raw.glossary || [],
    footnotes: raw.footnotes || {}
  };
}

/**
 * Live endpoint tester for any free provider model
 */
async function testEndpoint(providerId, modelId, providedKey = '') {
  const catalog = getCatalog();
  const provider = catalog.providers.find(p => p.id === providerId);
  if (!provider) {
    return { ok: false, error: `Provider "${providerId}" not found in catalog` };
  }

  const storedKeys = loadStoredKeys();
  let effectiveKey = providedKey || (storedKeys.keys && storedKeys.keys[providerId]) || storedKeys[providerId] || process.env[provider.envVar] || '';
  if (provider.keyless && !effectiveKey) {
    effectiveKey = provider.anonymousKey || 'anonymous';
  }

  const headers = { 'Content-Type': 'application/json' };
  if (!provider.noBearer && effectiveKey) {
    headers['Authorization'] = `Bearer ${effectiveKey}`;
  }

  const endpointUrl = `${provider.openaiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
  const targetModel = modelId || provider.models[0]?.id;

  const t0 = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
        max_tokens: 30,
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        latency_ms,
        error: `HTTP ${res.status}: ${errText.slice(0, 200)}`
      };
    }

    const json = await res.json().catch(() => ({}));
    let reply = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || '';
    if (!reply && json.choices?.[0]?.message?.reasoning) {
      reply = json.choices[0].message.reasoning;
    }

    // Record test usage
    recordUsage({
      providerId,
      modelId: targetModel,
      promptTokens: json.usage?.prompt_tokens || 10,
      completionTokens: json.usage?.completion_tokens || 5,
      latencyMs: latency_ms
    });

    return {
      ok: true,
      status: res.status,
      latency_ms,
      reply: reply.trim() || 'OK (200 Success)',
      model: targetModel,
      provider: provider.name
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      latency_ms: Date.now() - t0,
      error: err.name === 'AbortError' ? 'Connection timed out (12s)' : err.message
    };
  }
}

/**
 * Generate copyable code snippets for any free model
 */
function generateSnippet(providerId, modelId, language = 'python') {
  const catalog = getCatalog();
  const provider = catalog.providers.find(p => p.id === providerId) || catalog.providers[0];
  const targetModel = modelId || provider.models[0]?.id || 'model-name';
  const baseUrl = provider.openaiBaseUrl;

  const authKey = provider.keyless ? (provider.anonymousKey || 'anonymous') : `YOUR_${provider.envVar}`;

  if (language === 'python') {
    return `# Free LLM API: ${provider.name} (${targetModel})
# Base URL: ${baseUrl}
# Rate Limit: ${provider.models[0]?.rateLimit || 'Free Tier'}
from openai import OpenAI

client = OpenAI(
    api_key="${authKey}",
    base_url="${baseUrl}"
)

response = client.chat.completions.create(
    model="${targetModel}",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=100
)
print(response.choices[0].message.content)`;
  }

  if (language === 'curl') {
    const authHeader = provider.noBearer ? '' : `  -H "Authorization: Bearer ${authKey}" \\\n`;
    return `# Free LLM API cURL: ${provider.name}
curl -X POST "${baseUrl}/chat/completions" \\
  -H "Content-Type: application/json" \\
${authHeader}  -d '{
    "model": "${targetModel}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'`;
  }

  if (language === 'node') {
    return `// Free LLM API: ${provider.name} (${targetModel})
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${authKey}",
  baseURL: "${baseUrl}"
});

const completion = await client.chat.completions.create({
  model: "${targetModel}",
  messages: [{ role: "user", content: "Hello!" }],
  max_tokens: 100
});

console.log(completion.choices[0].message.content);`;
  }

  return '';
}

/**
 * Zero-Key fallback for instant autonomous inference
 */
function getKeylessFallback() {
  return {
    provider: 'kilo',
    providerName: 'Kilo Code (Keyless Free Tier)',
    model: 'kilo-auto/free',
    baseUrl: 'https://api.kilo.ai/api/gateway',
    apiKey: 'anonymous',
    rateLimit: '200 req/hr (No Key Needed)'
  };
}

module.exports = {
  getCatalog,
  testEndpoint,
  generateSnippet,
  getKeylessFallback,
  recordUsage,
  getUsageStats,
  PROVIDER_METADATA_MAP,
  PROVIDER_LIMITS
};
