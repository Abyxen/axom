/**
 * AXOM DeepSeek Harness (DSH) Core Microkernel
 * Implements the Cordis-inspired Agent Microkernel pattern:
 * - Spatiotemporal composability ("Everything is a plugin")
 * - Three-role capability seams (Service Definition, Service Provider, Consumer)
 * - Reversible effect management and lifecycle hooks
 */

const { EventEmitter } = require('node:events');

class HarnessContext {
  constructor(name = 'root', parent = null) {
    this.name = name;
    this.parent = parent;
    this.root = parent ? (parent.root || parent) : this;
    this.events = parent ? parent.events : new EventEmitter();
    this.services = parent ? parent.services : new Map();
    this.plugins = new Map();
    this.disposers = [];
    this.active = true;
  }

  /**
   * Create an isolated child execution context inheriting services
   */
  extend(scopeName) {
    return new HarnessContext(`${this.name}:${scopeName}`, this);
  }

  /**
   * Register a Service Provider at a capability seam
   * @param {string} name - Service name (e.g. 'model', 'memory', 'fs', 'sandbox')
   * @param {object} provider - Concrete service implementation
   */
  provide(name, provider) {
    const existing = this.services.get(name);
    this.services.set(name, provider);
    this.events.emit('service:registered', { name, provider, previous: existing });

    const disposer = () => {
      if (this.services.get(name) === provider) {
        if (existing) this.services.set(name, existing);
        else this.services.delete(name);
        this.events.emit('service:unregistered', { name });
      }
    };
    this.disposers.push(disposer);
    return disposer;
  }

  /**
   * Get an active service implementation
   */
  get(name) {
    const s = this.services.get(name);
    if (!s) {
      throw new Error(`[DSH Kernel] Required service "${name}" is not registered in harness context.`);
    }
    return s;
  }

  /**
   * Check if a service is currently provided
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Subscribe to lifecycle events with automatic disposal tracking
   */
  on(event, handler) {
    this.events.on(event, handler);
    const disposer = () => this.events.off(event, handler);
    this.disposers.push(disposer);
    return disposer;
  }

  /**
   * Emit an event through the harness bus
   */
  emit(event, ...args) {
    return this.events.emit(event, ...args);
  }

  /**
   * Mount a modular Harness Plugin
   * @param {object} plugin - { name, version, apply: (ctx) => void }
   */
  use(plugin, options = {}) {
    if (!plugin || typeof plugin.apply !== 'function') {
      throw new Error('[DSH Kernel] Invalid plugin: must provide an apply(ctx, options) function.');
    }

    const pluginName = plugin.name || `plugin_${Date.now()}`;
    if (this.plugins.has(pluginName)) {
      console.warn(`[DSH Kernel] Plugin "${pluginName}" is already mounted.`);
      return this;
    }

    const pluginCtx = this.extend(pluginName);
    try {
      plugin.apply(pluginCtx, options);
      this.plugins.set(pluginName, {
        name: pluginName,
        version: plugin.version || '1.0.0',
        description: plugin.description || '',
        category: plugin.category || 'General',
        context: pluginCtx,
        mountedAt: Date.now()
      });
      this.events.emit('plugin:mounted', { name: pluginName });
    } catch (err) {
      console.error(`[DSH Kernel] Failed to mount plugin "${pluginName}":`, err.message);
      pluginCtx.dispose();
      throw err;
    }

    return this;
  }

  /**
   * Unwind and dispose all registered effects in this context
   */
  dispose() {
    this.active = false;
    while (this.disposers.length) {
      const fn = this.disposers.pop();
      try { fn(); } catch (e) {}
    }
    for (const [name, p] of this.plugins.entries()) {
      p.context.dispose();
      this.events.emit('plugin:unmounted', { name });
    }
    this.plugins.clear();
  }

  /**
   * Export telemetry state of the harness
   */
  inspect() {
    return {
      contextName: this.name,
      active: this.active,
      services: Array.from(this.services.keys()),
      plugins: Array.from(this.plugins.values()).map(p => ({
        name: p.name,
        version: p.version,
        description: p.description,
        category: p.category,
        mountedAt: p.mountedAt
      }))
    };
  }
}

module.exports = {
  HarnessContext
};
