/**
 * DSH Plugin: Model Provider Seam
 * Connects local neural models on RTX 5060 and the multi-tier cascading cloud failover router.
 */

const { SEAMS } = require('../seams');

const ModelPlugin = {
  name: 'dsh-provider-model',
  version: '1.2.0',
  category: 'Inference',
  description: 'Local GPU neural inference (Ollama) with resilient multi-tier cascading cloud failover.',

  apply(ctx) {
    const aiProviders = require('../../ai_providers');
    const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://127.0.0.1:11434';

    const modelService = {
      resolveEffectiveModel(requestedModel = 'auto') {
        return aiProviders.resolveEffectiveModel(requestedModel);
      },

      isBasicPrompt(text) {
        return aiProviders.isBasicPrompt(text);
      },

      getProviderTelemetry() {
        return aiProviders.getDailyUsageStats();
      },

      async chat(payload) {
        const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return res.json();
      },

      async stream(payload, signal) {
        return fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });
      }
    };

    SEAMS.MODEL.validateProvider(modelService);
    ctx.provide('model', modelService);
  }
};

module.exports = ModelPlugin;
