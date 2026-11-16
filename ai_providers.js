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

const KEYS_FILE = path.join(__dirname, 'data', 'ai_keys.json');

const PROVIDER_METADATA = {
  groq: {
    id: 'groq',
    name: 'Groq',
    tagline: 'Ultra-Fast LPU Inference (Free Tier)',
    badge: '1,000 - 14,400 REQ/DAY FREE',
    keyUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    description: 'Custom Language Processing Unit (LPU) hardware providing hundreds of tokens per second. High free daily rate limits on Meta Llama and Google Gemma models.',
    envKey: 'GROQ_API_KEY',
    models: [
      { id: 'groq/llama-3.3-70b-versatile', rawId: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Groq LPU)' },
      { id: 'groq/llama-3.1-8b-instant', rawId: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Groq LPU)' },
      { id: 'groq/mixtral-8x7b-32768', rawId: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq LPU - 32k)' },
      { id: 'groq/gemma2-9b-it', rawId: 'gemma2-9b-it', name: 'Gemma 2 9B IT (Groq LPU)' }
    ]
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    tagline: 'Multi-Model Free Tier Gateway',
    badge: 'ROTATING FREE TIER MODELS',
    keyUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    description: 'A single unified API key for dozens of models with completely free access ($0.00) using :free model tags, including DeepSeek R1, Llama 3.3, and Qwen 2.5 Coder.',
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'openrouter/deepseek/deepseek-r1:free', rawId: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 Reasoner (OpenRouter Free)' },
      { id: 'openrouter/meta-llama/llama-3.3-70b-instruct:free', rawId: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (OpenRouter Free)' },
      { id: 'openrouter/google/gemini-2.0-flash-exp:free', rawId: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (OpenRouter Free)' },
      { id: 'openrouter/qwen/qwen-2.5-coder-32b-instruct:free', rawId: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (OpenRouter Free)' }
    ]
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini (AI Studio)',
    tagline: '1M+ Context & Multimodal Intelligence',
    badge: '1,500 REQ/DAY FREE',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    description: 'Generous 1,500 requests/day for Flash models with 1,000,000+ token context window. Supports native OpenAI-compatible API format.',
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini/gemini-2.0-flash', rawId: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Google AI Studio)' },
      { id: 'gemini/gemini-1.5-flash', rawId: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Google AI Studio)' },
      { id: 'gemini/gemini-1.5-pro', rawId: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Google AI Studio)' }
    ]
  },
  cerebras: {
    id: 'cerebras',
    name: 'Cerebras',
    tagline: 'World-Record 2,000+ Tokens/Sec',
    badge: '1,000,000 FREE TOKENS/DAY',
    keyUrl: 'https://cloud.cerebras.ai',
    baseUrl: 'https://api.cerebras.ai/v1',
    description: 'Wafer-scale engine with extreme throughput (often >2,000 tokens/sec). Offers a free developer quota of 1,000,000 tokens per day without a credit card.',
    envKey: 'CEREBRAS_API_KEY',
    models: [
      { id: 'cerebras/llama-3.3-70b', rawId: 'llama-3.3-70b', name: 'Llama 3.3 70B (Cerebras 2,000+ tok/s)' },
      { id: 'cerebras/llama3.1-8b', rawId: 'llama3.1-8b', name: 'Llama 3.1 8B (Cerebras Ultra-Fast)' }
    ]
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    tagline: 'Direct DeepSeek-R1 & V3 API',
    badge: 'REASONING & HIGH EFFICIENCY',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    baseUrl: 'https://api.deepseek.com/v1',
    description: 'Direct API connection for DeepSeek-R1 (chain-of-thought mathematical and coding reasoning) and DeepSeek-V3.',
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek/deepseek-chat', rawId: 'deepseek-chat', name: 'DeepSeek V3 (Chat)' },
      { id: 'deepseek/deepseek-reasoner', rawId: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)' }
    ]
  },
  custom: {
    id: 'custom',
    name: 'Custom / Local Proxy',
    tagline: 'Any OpenAI-Compatible Endpoint',
    badge: 'LOCAL / LM STUDIO / VLLM / PROXY',
    keyUrl: '',
    baseUrl: '',
    description: 'Connect any OpenAI-compatible local server (LM Studio, vLLM, LocalAI) or custom reverse proxy.',
    envKey: 'CUSTOM_AI_KEY',
    models: []
  }
};

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

    list.push({
      id: pId,
      name: meta.name,
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

  const provIds = ['groq', 'openrouter', 'gemini', 'cerebras', 'deepseek'];
  for (const pId of provIds) {
    if (typeof payload[pId] === 'string') {
      const val = payload[pId].trim();
      if (val && !val.includes('••••')) {
        cfg.keys[pId] = val;
      } else if (val === '') {
        delete cfg.keys[pId];
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

function getCombinedModelList() {
  const status = getProviderStatusList();
  const models = [
    {
      id: 'axom:1.1',
      name: 'Axom v1.1 (Local Hardware RTX 5060)',
      provider: 'local',
      providerName: 'AXOM Local Engine',
      isLocal: true,
      isConfigured: true
    }
  ];

  for (const prov of status.providers) {
    const meta = PROVIDER_METADATA[prov.id];
    if (prov.id === 'custom' && prov.isConfigured && prov.customModel) {
      models.push({
        id: `custom/${prov.customModel}`,
        name: `${prov.customModel} (Custom Proxy)`,
        provider: 'custom',
        providerName: 'Custom / Proxy',
        isLocal: false,
        isConfigured: true
      });
      continue;
    }

    if (meta && Array.isArray(meta.models)) {
      for (const m of meta.models) {
        models.push({
          id: m.id,
          name: m.name,
          provider: prov.id,
          providerName: prov.name,
          context: m.context,
          freeTierNote: m.freeTierNote,
          free_tier_note: m.freeTierNote,
          isLocal: false,
          isConfigured: prov.isConfigured
        });
      }
    }
  }

  return models;
}

function isCloudModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  return modelId.includes('/') && !modelId.startsWith('axom:');
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
  const meta = PROVIDER_METADATA[providerId];
  if (!meta) {
    return { success: false, error: `Unknown provider: ${providerId}` };
  }

  const effectiveKey = apiKey && apiKey.trim() ? apiKey.trim() : getEffectiveKey(providerId);
  const baseUrl = providerId === 'custom' ? customBaseUrl.trim() : meta.baseUrl;
  const testModel = providerId === 'custom' ? customModel.trim() : (meta.models[0]?.rawId || 'default');

  if (!baseUrl) {
    return { success: false, error: 'Missing base URL for provider.' };
  }
  if (providerId !== 'custom' && !effectiveKey) {
    return { success: false, error: 'Please enter a valid API key to test connection.' };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (effectiveKey) {
    headers['Authorization'] = `Bearer ${effectiveKey}`;
  }
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:8000';
    headers['X-Title'] = 'AXOM';
  }

  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'Say hello in 1 word.' }],
        max_tokens: 5,
        stream: false
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let parsedErr = errText;
      try {
        const j = JSON.parse(errText);
        parsedErr = j.error?.message || j.message || errText;
      } catch (e) {}
      return {
        ok: false,
        success: false,
        error: `HTTP ${res.status}: ${parsedErr.slice(0, 300)}`
      };
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '';
    return {
      ok: true,
      success: true,
      latency_ms: latencyMs,
      latencyMs,
      model: testModel,
      testModel,
      sampleOutput: reply.trim()
    };
  } catch (err) {
    return {
      ok: false,
      success: false,
      error: err.name === 'AbortError' ? 'Connection timed out (15s).' : err.message
    };
  }
}

/**
 * Universal OpenAI-compatible streaming chat completion for cloud distributors
 */
async function streamProviderChat({ modelId, messages, params = {}, signal, onChunk, onThink }) {
  const resolved = resolveProvider(modelId);
  if (!resolved) {
    throw new Error(`Unsupported cloud model identifier: ${modelId}`);
  }

  const { providerId, rawModel, meta } = resolved;
  const cfg = loadStoredConfig();
  const apiKey = getEffectiveKey(providerId);
  const baseUrl = providerId === 'custom' ? (cfg.custom?.baseUrl || '') : meta.baseUrl;

  if (providerId !== 'custom' && !apiKey) {
    throw new Error(`API key not configured for ${meta.name}. Please enter your free API key in Settings -> AI Providers.`);
  }
  if (!baseUrl) {
    throw new Error(`Base URL not configured for ${meta.name}.`);
  }

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
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
    temperature: typeof params.temperature === 'number' ? params.temperature : 0.6,
    max_tokens: typeof params.max_tokens === 'number' ? params.max_tokens : 2048,
    ...(Array.isArray(params.stop) && params.stop.length ? { stop: params.stop } : {})
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let msg = errText;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.error?.message || parsed.message || errText;
    } catch (e) {}
    throw new Error(`${meta.name} API error (${res.status}): ${msg}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let fullReasoning = '';

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
        return { content: fullText, reasoning: fullReasoning };
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Check for reasoning / thinking tokens (DeepSeek-R1 / QwQ)
          if (delta.reasoning_content || delta.reasoning) {
            const rChunk = delta.reasoning_content || delta.reasoning;
            fullReasoning += rChunk;
            if (onThink) onThink(rChunk);
          }

          if (delta.content) {
            fullText += delta.content;
            if (onChunk) onChunk(delta.content);
          }
        } catch (e) {
          // Ignore partial or unparseable SSE line
        }
      }
    }
  }

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
  isCloudModel,
  resolveProvider,
  testProviderConnection,
  streamProviderChat
};
