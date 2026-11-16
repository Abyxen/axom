/**
 * AXOM DeepSeek Harness (DSH) Entrypoint & Microkernel Bootstrap
 * Architecture:
 * - Microkernel: Cordis-style composable plugin context
 * - Capability Seams: 3-Role Pattern (Definition, Provider, Consumer)
 * - Providers: Filesystem, Sandbox, Memory, Browser, Subagents, Model
 * - Consumers: ConsumerTools (OpenAI/Ollama tool calling schema generator & dispatcher)
 */

const { HarnessContext } = require('./kernel');
const { CapabilitySeam, SEAMS } = require('./seams');

// Providers
const FilesystemPlugin = require('./plugins/provider_fs');
const SandboxPlugin = require('./plugins/provider_sandbox');
const MemoryPlugin = require('./plugins/provider_memory');
const BrowserPlugin = require('./plugins/provider_browser');
const SubagentsPlugin = require('./plugins/provider_subagents');
const ModelPlugin = require('./plugins/provider_model');

// Consumers
const ConsumerToolsPlugin = require('./plugins/consumer_tools');

// Instantiate root harness context
const harness = new HarnessContext('axom-root');

// Mount foundational capability providers
harness.use(FilesystemPlugin);
harness.use(SandboxPlugin);
harness.use(MemoryPlugin);
harness.use(BrowserPlugin);
harness.use(SubagentsPlugin);
harness.use(ModelPlugin);

// Mount tool-calling consumer
harness.use(ConsumerToolsPlugin);

/**
 * Returns harness system telemetry, active seams, and installed plugins
 */
function getHarnessStatus() {
  const inspection = harness.inspect();
  const seamsList = Object.entries(SEAMS).map(([key, seam]) => ({
    key,
    serviceName: seam.serviceName,
    description: seam.description,
    requiredMethods: seam.requiredMethods,
    isProvided: harness.has(seam.serviceName)
  }));

  return {
    status: 'online',
    architecture: 'DeepSeek Harness (Cordis microkernel)',
    version: '1.2.0',
    contextName: inspection.contextName,
    active: inspection.active,
    servicesCount: inspection.services.length,
    services: inspection.services,
    pluginsCount: inspection.plugins.length,
    plugins: inspection.plugins,
    seams: seamsList
  };
}

module.exports = {
  harness,
  HarnessContext,
  CapabilitySeam,
  SEAMS,
  getHarnessStatus
};
