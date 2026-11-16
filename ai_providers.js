/**
 * AXOM AI Providers Engine
 * Unified client for top free AI distributors:
 * - Groq (LPU Inference - Free Tier)
 * - OpenRouter (Aggregated Free Models: Llama 3.3, Gemini 2.0, DeepSeek R1, Qwen 2.5)
 * - Google Gemini (AI Studio - 1,500 req/day free, 1M context)
 * - Cerebras (Wafer-Scale 2,000+ tok/s - 1M free tokens/day)
 * - DeepSeek (Official DeepSeek-R1 & V3 API)
 * - Custom OpenAI-Compatible Endpoints (Local vLLM, LM Studio, Custom Proxy)
 */

const fs = require('fs');
const path = require('path');

const freeApisService = require('./free_apis_service');
const KEYS_FILE = path.join(__dirname, 'data', 'ai_keys.json');

function buildProviderMetadata() {
  const catalog = freeApisService.getCatalog();
  const map = {};

  for (const p of catalog.providers) {
    map[p.id] = {
      id: p.id,
      name: p.name,
      flag: p.flag || '🌐',
      country: p.country || '',
      tagline: p.description || '',
      badge: p.usage?.quotaLabel || (p.keyless ? 'KEYLESS FREE' : 'FREE TIER'),
      keyUrl: p.keyUrl || '',
      baseUrl: p.openaiBaseUrl || p.baseUrl,
      description: p.description || '',
      envKey: p.envVar || '',
      keyless: Boolean(p.keyless),
      noBearer: Boolean(p.noBearer),
      anonymousKey: p.anonymousKey || '',
      keyPrefix: p.keyPrefix || '',
      models: (p.models || []).map(m => ({
        id: `${p.id}/${m.id}`,
        rawId: m.id,
        name: `${m.name || m.id} (${p.name})`,
        modality: m.modality,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens
      }))
    };
  }

  map.custom = {
    id: 'custom',
    name: 'Custom OpenAI-Compatible Endpoint',
    tagline: 'Connect local vLLM, LM Studio, Ollama OpenAI or custom server',
    badge: 'SELF-HOSTED / PROXY',
    keyUrl: '',
    baseUrl: '',
    description: 'Connect any OpenAI-compatible server URL (e.g. http://localhost:1234/v1).',
    envKey: 'CUSTOM_API_KEY',
    models: []
  };

  return map;
}

const PROVIDER_METADATA = buildProviderMetadata();

function loadStoredConfig() {
  const defaults = {
    keys: {},
    custom: {
      baseUrl: '',
      model: ''
    },
    activeModel: 'axom:1.1'
  };

  try {
    if (fs.existsSync(KEYS_FILE)) {
      const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
      return {
        keys: { ...defaults.keys, ...(data.keys || {}) },
        custom: { ...defaults.custom, ...(data.custom || {}) },
        activeModel: data.activeModel || defaults.activeModel
      };
    }
  } catch (err) {
    console.warn('[AI_PROVIDERS] Warning reading keys file:', err.message);
  }

  return defaults;
}

function saveStoredConfig(config) {
  try {
    const dir = path.dirname(KEYS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KEYS_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[AI_PROVIDERS] Error saving keys file:', err);
    return false;
  }
}

function maskApiKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••${suffix}`;
}

function getEffectiveKey(providerId) {
  const cfg = loadStoredConfig();
  if (cfg.keys && cfg.keys[providerId] && cfg.keys[providerId].trim()) {
    return cfg.keys[providerId].trim();
  }
  const meta = PROVIDER_METADATA[providerId];
  if (meta && meta.envKey && process.env[meta.envKey]) {
    return process.env[meta.envKey].trim();
  }
  return '';
}

function getProviderStatusList() {
  const cfg = loadStoredConfig();
  const list = [];

  for (const [pId, meta] of Object.entries(PROVIDER_METADATA)) {
    const rawKey = getEffectiveKey(pId);
    const hasKey = Boolean(rawKey);
    const masked = maskApiKey(rawKey);

    let isConfigured = hasKey;
    if (pId === 'custom') {
      isConfigured = Boolean(cfg.custom?.baseUrl && cfg.custom?.model);
    }

    const usageStats = freeApisService.getUsageStats();
    const pUsage = usageStats.providers[pId] || {
      requestsToday: 0,
      requestsTotal: 0,
      tokensToday: 0,
      tokensTotal: 0,
      percentUsed: 0,
      remaining: 'Unlimited',
      quotaLabel: meta.badge || 'Free Tier',
      avgLatencyMs: 0
    };

    list.push({
      id: pId,
      name: meta.name,
      flag: meta.flag || '🌐',
      country: meta.country || '',
      usage: pUsage,
      tagline: meta.tagline,
      badge: meta.badge,
      free_tier: meta.badge || meta.tagline,
      freeTier: meta.badge || meta.tagline,
      keyUrl: meta.keyUrl,
      key_url: meta.keyUrl,
      baseUrl: pId === 'custom' ? (cfg.custom?.baseUrl || '') : meta.baseUrl,
      base_url: pId === 'custom' ? (cfg.custom?.baseUrl || '') : meta.baseUrl,
      description: meta.description,
      isConfigured,
      is_configured: isConfigured,
      hasKey,
      has_key: hasKey,
      maskedKey: masked,
      masked_key: masked,
      customModel: pId === 'custom' ? (cfg.custom?.model || '') : undefined,
      custom_model: pId === 'custom' ? (cfg.custom?.model || '') : undefined,
      models: meta.models.map(m => m.rawId || m.id)
    });
  }

  return {
    providers: list,
    activeModel: cfg.activeModel || 'axom:1.1'
  };
}

function saveProvidersConfig(payload = {}) {
  const cfg = loadStoredConfig();
  if (!cfg.keys) cfg.keys = {};

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'custom_url' || key === 'custom_model' || key === 'active_model') continue;
    if (typeof value === 'string') {
      const val = value.trim();
      if (val && !val.includes('••••')) {
        cfg.keys[key] = val;
      } else if (val === '') {
        delete cfg.keys[key];
      }
    }
  }

  if (!cfg.custom) cfg.custom = {};
  if (typeof payload.custom_url === 'string') {
    cfg.custom.baseUrl = payload.custom_url.trim();
  }
  if (typeof payload.custom_model === 'string') {
    cfg.custom.model = payload.custom_model.trim();
  }
  if (typeof payload.custom_key === 'string' || typeof payload.custom === 'string') {
    const val = (payload.custom_key || payload.custom || '').trim();
    if (val && !val.includes('••••')) {
      cfg.keys.custom = val;
    } else if (val === '') {
      delete cfg.keys.custom;
    }
  }

  if (payload.active_model && typeof payload.active_model === 'string') {
    cfg.activeModel = payload.active_model.trim();
  }

  saveStoredConfig(cfg);
  return {
    saved: true,
    status: getProviderStatusList()
  };
}

const MODEL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache
const providerModelCache = {
  openrouter: { timestamp: 0, models: [] },
  gemini: { timestamp: 0, models: [] },
  local: { timestamp: 0, models: [] }
};

/**
 * Dynamically fetch live models from a connected provider API
 */
async function fetchProviderLiveModels(providerId) {
  const meta = PROVIDER_METADATA[providerId];
  if (!meta) return [];

  const key = getEffectiveKey(providerId);
  if (!key && providerId !== 'custom') {
    return (meta.models || []).map(m => ({ ...m, provider: providerId, providerName: meta.name, isConfigured: false }));
  }

  const cache = providerModelCache[providerId];
  if (cache && cache.models.length && (Date.now() - cache.timestamp < MODEL_CACHE_TTL)) {
    return cache.models;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    if (providerId === 'openrouter') {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'http://localhost:8000',
          'X-Title': 'AXOM'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json.data) ? json.data : [];
        const mapped = rawList.map(m => {
          const isFree = m.id.endsWith(':free');
          return {
            id: `openrouter/${m.id}`,
            rawId: m.id,
            name: `${m.name || m.id}${isFree ? ' (Free)' : ''}`,
            provider: 'openrouter',
            providerName: 'OpenRouter',
            context: m.context_length ? `${Math.round(m.context_length / 1024)}k ctx` : undefined,
            isFree,
            freeTierNote: isFree ? 'Completely Free ($0.00)' : undefined,
            badge: isFree ? 'FREE' : undefined,
            isLocal: false,
            isConfigured: true
          };
        });

        // Sort: free models first, then alphabetical by name
        mapped.sort((a, b) => {
          if (a.isFree && !b.isFree) return -1;
          if (!a.isFree && b.isFree) return 1;
          return a.name.localeCompare(b.name);
        });

        providerModelCache.openrouter = { timestamp: Date.now(), models: mapped };
        return mapped;
      }
    } else if (providerId === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json.data) ? json.data : [];
        const mapped = rawList
          .filter(m => !m.id.includes('whisper'))
          .map(m => ({
            id: `groq/${m.id}`,
            rawId: m.id,
            name: `${m.id} (Groq LPU)`,
            provider: 'groq',
            providerName: 'Groq',
            badge: 'LPU FAST',
            isLocal: false,
            isConfigured: true
          }));
        providerModelCache.groq = { timestamp: Date.now(), models: mapped };
        return mapped;
      }
    } else if (providerId === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json.models) ? json.models : [];
        const mapped = rawList
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => {
            const cleanId = m.name.replace(/^models\//, '');
            return {
              id: `gemini/${cleanId}`,
              rawId: cleanId,
              name: `${m.displayName || cleanId} (Google Gemini)`,
              provider: 'gemini',
              providerName: 'Google Gemini (AI Studio)',
              context: m.inputTokenLimit ? `${Math.round(m.inputTokenLimit / 1024)}k ctx` : '1M ctx',
              badge: '1M CTX',
              isLocal: false,
              isConfigured: true
            };
          });
        providerModelCache.gemini = { timestamp: Date.now(), models: mapped };
        return mapped;
      }
    } else if (providerId === 'cerebras') {
      const res = await fetch('https://api.cerebras.ai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json.data) ? json.data : [];
        const mapped = rawList.map(m => ({
          id: `cerebras/${m.id}`,
          rawId: m.id,
          name: `${m.id} (Cerebras Wafer-Scale)`,
          provider: 'cerebras',
          providerName: 'Cerebras',
          badge: '2000 TOK/S',
          isLocal: false,
          isConfigured: true
        }));
        providerModelCache.cerebras = { timestamp: Date.now(), models: mapped };
        return mapped;
      }
    } else if (providerId === 'deepseek') {
      const res = await fetch('https://api.deepseek.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json.data) ? json.data : [];
        const mapped = rawList.map(m => ({
          id: `deepseek/${m.id}`,
          rawId: m.id,
          name: `${m.id === 'deepseek-reasoner' ? 'DeepSeek R1 Reasoner' : 'DeepSeek V3 Chat'}`,
          provider: 'deepseek',
          providerName: 'DeepSeek',
          badge: m.id === 'deepseek-reasoner' ? 'REASONER' : 'CHAT',
          isLocal: false,
          isConfigured: true
        }));
        providerModelCache.deepseek = { timestamp: Date.now(), models: mapped };
        return mapped;
      }
    }
  } catch (e) {
    console.warn(`[AI_PROVIDERS] Live model fetch for ${providerId} notice:`, e.message);
  }

  return (meta.models || []).map(m => ({
    id: m.id,
    rawId: m.rawId || m.id,
    name: m.name,
    provider: providerId,
    providerName: meta.name,
    isLocal: false,
    isConfigured: Boolean(key)
  }));
}

/**
 * Discover locally installed Ollama models
 */
async function fetchLocalOllamaModels() {
  const cache = providerModelCache.local;
  if (cache && cache.models.length && (Date.now() - cache.timestamp < MODEL_CACHE_TTL)) {
    return cache.models;
  }

  const baseLocal = [
    {
      id: 'axom:1.1',
      name: 'Axom v1.1 (Local Hardware RTX 5060)',
      provider: 'local',
      providerName: 'AXOM Local Engine',
      badge: 'RTX 5060',
      isLocal: true,
      isConfigured: true
    }
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.models) ? json.models : [];
      const result = [];
      const seen = new Set();

      result.push(baseLocal[0]);
      seen.add('axom:1.1');

      for (const m of list) {
        if (!seen.has(m.name) && !m.name.includes('embedding') && m.name !== 'axom:latest') {
          seen.add(m.name);
          result.push({
            id: m.name,
            name: `${m.name} (Local Ollama)`,
            provider: 'local',
            providerName: 'AXOM Local Engine',
            badge: 'LOCAL',
            isLocal: true,
            isConfigured: true
          });
        }
      }
      providerModelCache.local = { timestamp: Date.now(), models: result };
      return result;
    }
  } catch (e) {}

  return baseLocal;
}

/**
 * Check if input is a simple greeting or casual chitchat
 */
function isBasicPrompt(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim().toLowerCase();
  if (t.length <= 40) {
    if (/^(hi|hello|hey|yo|sup|hiya|howdy|good\s+(morning|afternoon|evening|day)|how\s+are\s+you|what'?s\s+up|who\s+are\s+you|ola|olá|oi|tudo\s+bem|como\s+vai)\b[\s!.?]*$/i.test(t)) {
      return true;
    }
  }
  return false;
}

/**
 * Asynchronously fetch combined model list - exactly two user choices: auto and axom:1.1
 */
async function getCombinedModelListAsync({ force = false } = {}) {
  // Pre-warm provider model cache in background for auto-routing
  if (force || !providerModelCache.openrouter.models.length) {
    fetchProviderLiveModels('openrouter').catch(() => {});
  }
  if (force || !providerModelCache.gemini.models.length) {
    fetchProviderLiveModels('gemini').catch(() => {});
  }

  return [
    {
      id: 'auto',
      name: 'Auto (Best Model)',
      provider: 'auto',
      providerName: '⚡ Auto-Router',
      isAuto: true,
      badge: 'BEST MODEL',
      description: 'Automatically analyzes your prompt. If simple (like "hi"), replies instantly without thinking or web search. If complex or real-time, autonomously routes to Axom, OpenRouter Free, or Google Gemini.'
    },
    {
      id: 'axom:1.1',
      name: 'Axom v1.1 (Local Hardware RTX 5060)',
      provider: 'local',
      providerName: 'AXOM Local Engine',
      badge: 'RTX 5060',
      isLocal: true,
      isConfigured: true,
      description: '100% private and offline neural inference running locally on your NVIDIA GeForce RTX 5060.'
    }
  ];
}

function getCombinedModelList() {
  return [
    {
      id: 'auto',
      name: 'Auto (Best Model)',
      provider: 'auto',
      providerName: '⚡ Auto-Router',
      isAuto: true,
      badge: 'BEST MODEL',
      description: 'Automatically analyzes your prompt. If simple (like "hi"), replies instantly without thinking or web search. If complex or real-time, autonomously routes to Axom, OpenRouter Free, or Google Gemini.'
    },
    {
      id: 'axom:1.1',
      name: 'Axom v1.1 (Local Hardware RTX 5060)',
      provider: 'local',
      providerName: 'AXOM Local Engine',
      badge: 'RTX 5060',
      isLocal: true,
      isConfigured: true,
      description: '100% private and offline neural inference running locally on your NVIDIA GeForce RTX 5060.'
    }
  ];
}

/**
 * Intelligent task-based model router
 * Routes strictly among Axom v1.1 (Local RTX 5060), OpenRouter (Free), and Google Gemini.
 */
function selectBestModelForTask(prompt = '', options = {}) {
  const { isRag = false, hasWebSearch = false, hasAttachments = false } = options;
  const status = getProviderStatusList();
  const lower = String(prompt).toLowerCase();

  const isProvOk = (pId) => {
    const found = status.providers.find(p => p.id === pId);
    return Boolean(found && found.isConfigured);
  };

  // 0. Basic Greetings & Simple Casual Chitchat (No thinking, instant response)
  if (isBasicPrompt(prompt)) {
    if (isProvOk('openrouter')) {
      return {
        selectedModel: 'openrouter/nvidia/nemotron-3.5-lightning:free',
        selectedModelName: 'Nemotron 3.5 Lightning (Free)',
        providerName: 'OpenRouter Free Tier',
        category: 'instant',
        isBasic: true,
        reason: 'Instant reply without thinking or web search'
      };
    }
    if (isProvOk('gemini')) {
      return {
        selectedModel: 'gemini/gemini-2.0-flash',
        selectedModelName: 'Gemini 2.0 Flash',
        providerName: 'Google Gemini',
        category: 'instant',
        isBasic: true,
        reason: 'Instant reply without thinking or web search'
      };
    }
    return {
      selectedModel: 'axom:1.1',
      selectedModelName: 'Axom v1.1',
      providerName: 'AXOM Local Engine',
      category: 'instant',
      isBasic: true,
      reason: 'Local RTX 5060 instant response'
    };
  }

  // 1. High Context & Grounded Documents (RAG, long inputs, or attachments)
  if (isRag || prompt.length > 4000 || hasAttachments) {
    if (isProvOk('gemini')) {
      return {
        selectedModel: 'gemini/gemini-2.0-flash',
        selectedModelName: 'Gemini 2.0 Flash',
        providerName: 'Google Gemini (AI Studio)',
        category: 'context',
        reason: '1M+ context window for deep document grounding & retrieval'
      };
    }
    if (isProvOk('openrouter')) {
      const freeModel = providerModelCache.openrouter?.models?.find(m => m.isFree && (m.id.includes('ernie') || m.id.includes('llama') || m.id.includes('gemma')))?.id;
      return {
        selectedModel: freeModel || 'openrouter/baidu/ernie-5.5-flash-preview:free',
        selectedModelName: 'Ernie 5.5 Flash (Free)',
        providerName: 'OpenRouter Free Tier',
        category: 'context',
        reason: 'Large context window with grounded document reasoning'
      };
    }
    return {
      selectedModel: 'axom:1.1',
      selectedModelName: 'Axom v1.1',
      providerName: 'AXOM Local Engine',
      category: 'local',
      reason: 'Local hardware grounding via RTX 5060'
    };
  }

  // 2. Code & Programming Logic
  const codePatterns = [
    /\b(function|def|class|const|let|var|return|async|await|import|export)\b/,
    /\b(python|javascript|typescript|c\+\+|java|rust|golang|sql|html|css|json)\b/,
    /\b(bug|error|exception|debug|syntax|refactor|regex|algorithm|api|endpoint)\b/,
    /```/
  ];
  if (codePatterns.some(p => p.test(lower))) {
    if (isProvOk('openrouter')) {
      const coderModel = providerModelCache.openrouter?.models?.find(m => m.id.includes('code') || m.id.includes('coder'))?.id
        || 'openrouter/cohere/north-mini-code:free';
      return {
        selectedModel: coderModel,
        selectedModelName: 'Cohere North Mini Code (Free)',
        providerName: 'OpenRouter Free Tier',
        category: 'code',
        reason: 'High-density code syntax and algorithmic intelligence'
      };
    }
    if (isProvOk('gemini')) {
      return {
        selectedModel: 'gemini/gemini-2.0-flash',
        selectedModelName: 'Gemini 2.0 Flash',
        providerName: 'Google Gemini (AI Studio)',
        category: 'code',
        reason: 'High-speed code synthesis and algorithmic problem solving'
      };
    }
    return {
      selectedModel: 'axom:1.1',
      selectedModelName: 'Axom v1.1',
      providerName: 'AXOM Local Engine',
      category: 'local',
      reason: 'Local neural code synthesizer'
    };
  }

  // 3. Mathematical, Deep Logical Reasoning & Scientific Proofs
  const mathPatterns = [
    /\b(prove|proof|theorem|derive|derivation|calculate|equation|integral|matrix|probability)\b/,
    /\b(step-by-step|step by step|logical analysis|philosophy|counterexample|falsifiable)\b/,
    /\b(dossier|scientific peer review|literature matrix)\b/
  ];
  if (mathPatterns.some(p => p.test(lower))) {
    if (isProvOk('openrouter')) {
      const reasonerModel = providerModelCache.openrouter?.models?.find(m => m.id.includes('reasoning') || m.id.includes('r1'))?.id
        || 'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
      return {
        selectedModel: reasonerModel,
        selectedModelName: 'Nemotron Nano Reasoning (Free)',
        providerName: 'OpenRouter Free Tier',
        category: 'reasoning',
        reason: 'Full chain-of-thought mathematical & logical reasoning'
      };
    }
    if (isProvOk('gemini')) {
      return {
        selectedModel: 'gemini/gemini-2.0-flash',
        selectedModelName: 'Gemini 2.0 Flash',
        providerName: 'Google Gemini (AI Studio)',
        category: 'reasoning',
        reason: 'Deep multi-step analytical reasoning'
      };
    }
    return {
      selectedModel: 'axom:1.1',
      selectedModelName: 'Axom v1.1',
      providerName: 'AXOM Local Engine',
      category: 'local',
      reason: 'Local neural reasoning core'
    };
  }

  // 4. Ultra-Fast Chit-Chat, Short Queries, Translations (< 80 chars)
  if (prompt.length < 80) {
    if (isProvOk('openrouter')) {
      return {
        selectedModel: 'openrouter/nvidia/nemotron-3.5-lightning:free',
        selectedModelName: 'Nemotron 3.5 Lightning (Free)',
        providerName: 'OpenRouter Free Tier',
        category: 'speed',
        reason: 'Sub-50ms ultra-fast cloud response'
      };
    }
    if (isProvOk('gemini')) {
      return {
        selectedModel: 'gemini/gemini-2.0-flash',
        selectedModelName: 'Gemini 2.0 Flash',
        providerName: 'Google Gemini (AI Studio)',
        category: 'speed',
        reason: 'Ultra-fast low-latency cloud inference'
      };
    }
  }

  // 5. Default General Routing (Best Available Free Cloud or Local)
  if (isProvOk('openrouter')) {
    const generalModel = providerModelCache.openrouter?.models?.find(m => m.isFree && !m.id.includes('code') && !m.id.includes('reasoning'))?.id
      || 'openrouter/nvidia/nemotron-3.5-lightning:free';
    return {
      selectedModel: generalModel,
      selectedModelName: 'Nemotron 3.5 Lightning (Free)',
      providerName: 'OpenRouter Free Tier',
      category: 'general',
      reason: 'Balanced versatile flagship instruction model'
    };
  }
  if (isProvOk('gemini')) {
    return {
      selectedModel: 'gemini/gemini-2.0-flash',
      selectedModelName: 'Gemini 2.0 Flash',
      providerName: 'Google Gemini (AI Studio)',
      category: 'general',
      reason: 'High-speed multimodal intelligence'
    };
  }

  return {
    selectedModel: 'axom:1.1',
    selectedModelName: 'Axom v1.1',
    providerName: 'AXOM Local Engine',
    category: 'local',
    reason: 'Offline private inference on NVIDIA GeForce RTX 5060'
  };
}

function isCloudModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  return modelId.includes('/') && !modelId.startsWith('axom:');
}


/**
 * Resolves a resilient cascading failover chain for free tiers
 */
function getFailoverCandidates(failedModelId) {
  const candidates = [];
  const resolved = resolveProvider(failedModelId);
  const failedProvId = resolved?.providerId;
  const cfg = loadStoredConfig();

  // 1. Configured cloud providers with active keys (Groq -> Gemini -> OpenRouter -> Cohere -> Aion -> NVIDIA)
  const priorityOrder = ['groq', 'gemini', 'openrouter', 'cohere', 'aion', 'nvidia', 'zai', 'siliconflow'];
  for (const pId of priorityOrder) {
    if (pId === failedProvId) continue;
    const key = getEffectiveKey(pId);
    if (key && PROVIDER_METADATA[pId]?.models?.length) {
      const topModel = PROVIDER_METADATA[pId].models[0];
      candidates.push({
        providerId: pId,
        modelId: topModel.id,
        name: PROVIDER_METADATA[pId].name,
        type: 'configured_cloud'
      });
    }
  }

  // 2. Guaranteed keyless permanent free gateways
  if (failedProvId !== 'kilo') {
    candidates.push({
      providerId: 'kilo',
      modelId: 'kilo/nvidia/nemotron-3.5-lightning:free',
      name: 'Kilo Code (Keyless)',
      type: 'keyless'
    });
  }
  if (failedProvId !== 'llm7') {
    candidates.push({
      providerId: 'llm7',
      modelId: 'llm7/gpt-oss:20b',
      name: 'LLM7.io (Keyless)',
      type: 'keyless'
    });
  }
  if (failedProvId !== 'ovhcloud') {
    candidates.push({
      providerId: 'ovhcloud',
      modelId: 'ovhcloud/Meta-Llama-3.1-70B-Instruct',
      name: 'OVHcloud AI (Keyless EU)',
      type: 'keyless'
    });
  }

  return candidates;
}

function resolveProvider(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  const parts = modelId.split('/');
  const prefix = parts[0];
  const meta = PROVIDER_METADATA[prefix];
  if (!meta) return null;

  const rawModel = parts.slice(1).join('/');
  return {
    providerId: prefix,
    rawModel,
    meta
  };
}

/**
 * Test connectivity and auth for any provider
 */
async function testProviderConnection(providerId, apiKey, customBaseUrl = '', customModel = '') {
  if (providerId === 'custom') {
    const baseUrl = customBaseUrl.trim();
    if (!baseUrl) return { ok: false, success: false, error: 'Custom base URL is required' };
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: customModel || 'default',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 15
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const latency_ms = Date.now() - t0;
      if (!res.ok) return { ok: false, success: false, status: res.status, error: `HTTP ${res.status}` };
      return { ok: true, success: true, latency_ms, latency: `${latency_ms}ms`, model: customModel };
    } catch (e) {
      return { ok: false, success: false, error: e.message };
    }
  }

  const res = await freeApisService.testEndpoint(providerId, customModel, apiKey);
  return {
    ok: res.ok,
    success: res.ok,
    latency_ms: res.latency_ms,
    latency: `${res.latency_ms}ms`,
    status: res.status,
    model: res.model,
    sampleReply: res.reply,
    error: res.error
  };
}

/**
 * Universal OpenAI-compatible streaming chat completion for cloud distributors
 */
async function streamProviderChat({ model, modelId, messages, temperature, max_tokens, params = {}, res, signal, isBasic = false, onChunk, onThink, onFinish, enableFailover = true, attempt = 0, candidates = null }) {
  const chosenModel = model || modelId;
  const resolved = resolveProvider(chosenModel);
  if (!resolved) {
    const err = new Error(`Unsupported cloud model identifier: ${chosenModel}`);
    if (res && typeof res.write === 'function') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      return res.end();
    }
    throw err;
  }

  const { providerId, rawModel, meta } = resolved;
  const streamStartTime = Date.now();
  const cfg = loadStoredConfig();
  let apiKey = getEffectiveKey(providerId);
  if (providerId === 'kilo' && !apiKey) apiKey = 'anonymous';
  const isKeyless = Boolean(meta.keyless || providerId === 'kilo' || providerId === 'llm7' || providerId === 'ovhcloud');
  const baseUrl = providerId === 'custom' ? (cfg.custom?.baseUrl || '') : meta.baseUrl;

  if (!isKeyless && providerId !== 'custom' && !apiKey) {
    const err = new Error(`API key not configured for ${meta.name}. Please enter your free API key in Settings -> AI Providers.`);
    if (res && typeof res.write === 'function') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      return res.end();
    }
    throw err;
  }
  if (!baseUrl) {
    const err = new Error(`Base URL not configured for ${meta.name}.`);
    if (res && typeof res.write === 'function') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      return res.end();
    }
    throw err;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey && providerId !== 'ovhcloud') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:8000';
    headers['X-Title'] = 'AXOM';
  }

  // Format messages for standard OpenAI format (clean strings)
  const formattedMessages = messages.map(m => ({
    role: m.role === 'tool' ? 'tool' : (m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user')),
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
  }));

  const payload = {
    model: rawModel,
    messages: formattedMessages,
    stream: true,
    temperature: typeof temperature === 'number' ? temperature : (typeof params.temperature === 'number' ? params.temperature : 0.6),
    max_tokens: typeof max_tokens === 'number' ? max_tokens : (typeof params.max_tokens === 'number' ? params.max_tokens : 2048),
    ...(Array.isArray(params.stop) && params.stop.length ? { stop: params.stop } : {})
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });
  } catch (fetchErr) {
    const errMsg = fetchErr.name === 'AbortError' ? 'Generation stopped.' : `Network error connecting to ${meta.name}: ${fetchErr.message}`;
    if (fetchErr.name !== 'AbortError' && enableFailover) {
      if (!candidates) candidates = getFailoverCandidates(chosenModel);
      if (attempt < candidates.length) {
        const next = candidates[attempt];
        console.warn(`[AI_FAILOVER] ${meta.name} failed: ${errMsg}. Auto-cascading to ${next.name} (${next.modelId})...`);
        if (res && typeof res.write === 'function' && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'failover_notice', from: meta.name, to: next.name, toModel: next.modelId, reason: errMsg })}\n\n`);
        }
        return await streamProviderChat({
          model: next.modelId,
          messages,
          temperature,
          max_tokens,
          params,
          res,
          signal,
          isBasic,
          onChunk,
          onThink,
          onFinish,
          enableFailover: true,
          attempt: attempt + 1,
          candidates
        });
      }
    }
    if (res && typeof res.write === 'function') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
      return res.end();
    }
    throw new Error(errMsg);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    let msg = errText;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.error?.message || parsed.message || errText;
    } catch (e) {}
    const fullErrMsg = `${meta.name} error (${response.status}): ${msg}`;
    // If rate limit (429), quota exceeded, or service overloaded (500, 502, 503, 504), cascade automatically!
    if (enableFailover && (response.status === 429 || response.status >= 500)) {
      if (!candidates) candidates = getFailoverCandidates(chosenModel);
      if (attempt < candidates.length) {
        const next = candidates[attempt];
        console.warn(`[AI_FAILOVER] ${meta.name} returned HTTP ${response.status}. Auto-cascading to ${next.name} (${next.modelId})...`);
        if (res && typeof res.write === 'function' && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'failover_notice', from: meta.name, to: next.name, toModel: next.modelId, reason: `HTTP ${response.status}: ${msg.slice(0, 80)}` })}\n\n`);
        }
        return await streamProviderChat({
          model: next.modelId,
          messages,
          temperature,
          max_tokens,
          params,
          res,
          signal,
          isBasic,
          onChunk,
          onThink,
          onFinish,
          enableFailover: true,
          attempt: attempt + 1,
          candidates
        });
      }
    }
    if (res && typeof res.write === 'function') {
      res.write(`data: ${JSON.stringify({ type: 'error', message: fullErrMsg })}\n\n`);
      return res.end();
    }
    throw new Error(fullErrMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let fullReasoning = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          if (res && typeof res.write === 'function' && !res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`);
            res.end();
          }
          const latencyMs = Date.now() - streamStartTime;
          try {
            const promptLen = messages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 20), 0);
            freeApisService.recordUsage({
              providerId,
              modelId: rawModel,
              promptTokens: Math.max(1, Math.round(promptLen / 4)),
              completionTokens: Math.max(1, Math.round(fullText.length / 4)),
              latencyMs
            });
          } catch (e) {}
          if (onFinish) onFinish(fullText);
          return { content: fullText, reasoning: fullReasoning };
        }

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Check for reasoning / thinking tokens (DeepSeek-R1 / QwQ)
            // If prompt is basic chit-chat, suppress thinking completely for instant reply
            if (!isBasic && (delta.reasoning_content || delta.reasoning)) {
              const rChunk = delta.reasoning_content || delta.reasoning;
              fullReasoning += rChunk;
              if (res && typeof res.write === 'function') {
                res.write(`data: ${JSON.stringify({ type: 'think', text: rChunk })}\n\n`);
              }
              if (onThink) onThink(rChunk);
            }

            if (delta.content) {
              let cleanContent = delta.content;
              if (isBasic) {
                cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '');
              }
              if (cleanContent) {
                fullText += cleanContent;
                if (res && typeof res.write === 'function') {
                  res.write(`data: ${JSON.stringify({ type: 'content', text: cleanContent })}\n\n`);
                }
                if (onChunk) onChunk(cleanContent);
              }
            }
          } catch (e) {
            // Ignore partial or unparseable SSE line
          }
        }
      }
    }
  } catch (streamErr) {
    if (streamErr.name !== 'AbortError') {
      console.warn('[AI_PROVIDERS] Stream read warning:', streamErr.message);
    }
  }

  if (res && typeof res.write === 'function' && !res.writableEnded) {
    res.write(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`);
    res.end();
  }
  if (onFinish) onFinish(fullText);
  return { content: fullText, reasoning: fullReasoning };
}

module.exports = {
  PROVIDER_METADATA,
  loadStoredConfig,
  saveStoredConfig,
  saveProvidersConfig,
  maskApiKey,
  getEffectiveKey,
  getProviderStatusList,
  getCombinedModelList,
  getCombinedModelListAsync,
  fetchProviderLiveModels,
  fetchLocalOllamaModels,
  selectBestModelForTask,
  isCloudModel,
  resolveProvider,
  getFailoverCandidates,
  testProviderConnection,
  streamProviderChat,
  isBasicPrompt
};
