/**
 * AXOM DeepSeek Harness: Capability Seams Architecture
 * Formalizes the "Three-Role Pattern":
 * 1. Service Definition: Declares capability interface & invariants.
 * 2. Service Provider: Supplies concrete implementation (Local, Cloud, Mock).
 * 3. Consumer: Generates model-facing tool schemas and routes tool execution.
 */

class CapabilitySeam {
  constructor(serviceName, description, requiredMethods = []) {
    this.serviceName = serviceName;
    this.description = description;
    this.requiredMethods = requiredMethods;
  }

  /**
   * Validate that a concrete provider satisfies the seam contract
   */
  validateProvider(provider) {
    if (!provider || typeof provider !== 'object') {
      throw new Error(`[DSH Seam:${this.serviceName}] Provider must be a valid object.`);
    }
    for (const m of this.requiredMethods) {
      if (typeof provider[m] !== 'function') {
        throw new Error(`[DSH Seam:${this.serviceName}] Provider is missing required method: "${m}"`);
      }
    }
    return true;
  }
}

/**
 * Standard Capability Seam Specifications in AXOM
 */
const SEAMS = {
  MODEL: new CapabilitySeam('model', 'Neural LLM Inference & Cascading Failover Gateway', ['chat', 'stream']),
  MEMORY: new CapabilitySeam('memory', 'Living Brain SQLite Profile & Obsidian Vault Synchronization', ['getProfile', 'getVaultKnowledge', 'saveMessage']),
  FILESYSTEM: new CapabilitySeam('filesystem', 'Desktop & Local Workspace File Management', ['createFolder', 'writeFile', 'readFile']),
  SANDBOX: new CapabilitySeam('sandbox', 'Subprocess Watchdog Code Execution', ['runCode']),
  BROWSER: new CapabilitySeam('browser', 'Live Web Navigation, Search & Scraping', ['searchWeb', 'browseUrl']),
  SUBAGENTS: new CapabilitySeam('subagents', 'Specialized Persona Task Delegation', ['getSubagents', 'invoke'])
};

module.exports = {
  CapabilitySeam,
  SEAMS
};
