/**
 * DSH Plugin: Subagents Orchestration Provider
 * Manages the 7 specialized agent personas and isolated delegation.
 */

const { SEAMS } = require('../seams');

const SubagentsPlugin = {
  name: 'dsh-provider-subagents',
  version: '1.2.0',
  category: 'Orchestration',
  description: 'Specialized subagent personas (Coder, Researcher, Designer, Security, Reviewer, Swarm, Browser).',

  apply(ctx) {
    const subagents = require('../../subagents');

    const subagentsService = {
      getSubagents() {
        return subagents.getSubagents();
      },

      getSubagent(id) {
        return subagents.getSubagent(id);
      },

      async invoke(options) {
        return subagents.invokeSubagent(options);
      }
    };

    SEAMS.SUBAGENTS.validateProvider(subagentsService);
    ctx.provide('subagents', subagentsService);
  }
};

module.exports = SubagentsPlugin;
