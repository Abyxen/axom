/**
 * DSH Plugin: Model Tool Calling Consumer
 * Consumes active Capability Seam Providers (Filesystem, Sandbox, Browser, Subagents, Memory)
 * and formats them into standard OpenAI/Ollama function tool calling schemas.
 * Dispatches autonomous tool execution across the microkernel.
 */

const path = require('node:path');
const axomSkills = require('../../axom_skills');
const researchSkills = require('../../research_skills');
const mcpClient = require('../../mcp_client');
const localTools = require('../../local_tools');

// Specialized tool schemas for Seam Providers
const CORE_SEAM_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_code',
      description: 'Execute Python or JavaScript code inside the safe subprocess sandbox with stdout/stderr capture.',
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['python', 'javascript', 'js', 'py'],
            description: 'Language runtime to execute code in.'
          },
          code: {
            type: 'string',
            description: 'Source code snippet to execute.'
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delegate_to_subagent',
      description: 'Delegate a specialized task to an autonomous subagent persona (coder, research, designer, security, reviewer, swarm, browser).',
      parameters: {
        type: 'object',
        properties: {
          persona_id: {
            type: 'string',
            enum: ['coder', 'research', 'designer', 'security', 'reviewer', 'swarm', 'browser'],
            description: 'Target subagent persona to delegate the task to.'
          },
          prompt: {
            type: 'string',
            description: 'Specific actionable prompt and instructions for the subagent.'
          }
        },
        required: ['persona_id', 'prompt']
      }
    }
  }
];

const ConsumerToolsPlugin = {
  name: 'dsh-consumer-tools',
  version: '1.2.0',
  category: 'Consumer',
  description: 'Aggregates capability seam providers into unified OpenAI/Ollama tool calling schemas and dispatches model execution.',

  apply(ctx) {
    const consumerToolsService = {
      /**
       * Returns all available tools for a chat turn based on runtime flags
       */
      getAvailableTools({
        webSearchEnabled = true,
        researchModeEnabled = false,
        mcpEnabled = true,
        skillsEnabled = true
      } = {}) {
        const tools = [];

        // 1. Filesystem Seam Tools
        if (ctx.has('filesystem')) {
          tools.push(...localTools.LOCAL_SYSTEM_TOOLS);
        }

        // 2. Sandbox Seam Tools
        if (ctx.has('sandbox')) {
          tools.push(CORE_SEAM_TOOLS[0]); // run_code
        }

        // 3. Browser Seam Tools
        if (ctx.has('browser') && webSearchEnabled) {
          tools.push(...ctx.get('browser').getTools());
        }

        // 4. Subagents Seam Tools
        if (ctx.has('subagents')) {
          tools.push(CORE_SEAM_TOOLS[1]); // delegate_to_subagent
        }

        // 5. MCP Server tools (system_info, calculate_or_eval, search_living_memory)
        if (mcpEnabled && mcpClient && Array.isArray(mcpClient.MCP_TOOLS)) {
          tools.push(...mcpClient.MCP_TOOLS);
        }

        // 6. Skills consultation tool
        if (skillsEnabled && axomSkills && Array.isArray(axomSkills.SKILL_TOOLS)) {
          tools.push(...axomSkills.SKILL_TOOLS);
        }

        // 7. Academic research tools
        if (researchModeEnabled && researchSkills && Array.isArray(researchSkills.ACADEMIC_TOOLS)) {
          tools.push(...researchSkills.ACADEMIC_TOOLS);
        }

        return tools;
      },

      /**
       * Unified execution dispatcher that routes to the appropriate seam provider
       */
      async executeTool(toolName, toolArgs = {}, options = {}) {
        const startTime = Date.now();
        ctx.emit('tool:invoke', { tool: toolName, args: toolArgs, timestamp: startTime });

        try {
          let result;

          // 1. Filesystem Seam
          if (toolName === 'create_folder' && ctx.has('filesystem')) {
            const fsService = ctx.get('filesystem');
            result = await fsService.createFolder(toolArgs.folder_path || toolArgs.path || toolArgs.dir);
          } else if (toolName === 'write_file' && ctx.has('filesystem')) {
            const fsService = ctx.get('filesystem');
            result = await fsService.writeFile(toolArgs.file_path || toolArgs.path || toolArgs.filename, toolArgs.content || '');
          } else if (toolName === 'generate_file' && ctx.has('filesystem')) {
            const fsService = ctx.get('filesystem');
            result = await fsService.generateFile({
              filePath: toolArgs.file_path || toolArgs.path || toolArgs.filename,
              fileType: toolArgs.file_type,
              content: toolArgs.content || '',
              title: toolArgs.title,
              files: toolArgs.files,
              base64Data: toolArgs.base64_data || toolArgs.base64Data,
              sourceDir: toolArgs.source_dir || toolArgs.sourceDir
            });
          } else if (toolName === 'read_file' && ctx.has('filesystem')) {
            const fsService = ctx.get('filesystem');
            const content = await fsService.readFile(toolArgs.file_path || toolArgs.path);
            result = {
              success: true,
              path: toolArgs.file_path || toolArgs.path,
              content: content.length > 10000 ? content.slice(0, 10000) + '... [truncated]' : content
            };
          }

          // 2. MCP Client Tools (system_info, calculate_or_eval, search_living_memory)
          else if (mcpClient && typeof mcpClient.isMcpTool === 'function' && mcpClient.isMcpTool(toolName)) {
            result = await mcpClient.executeTool(toolName, toolArgs);
          }

          // 3. Sandbox Seam (Subprocess execution for run_code)
          else if (toolName === 'run_code' && ctx.has('sandbox')) {
            const sandboxService = ctx.get('sandbox');
            result = await sandboxService.runCode({
              language: toolArgs.language || 'python',
              code: toolArgs.code || '',
              timeoutMs: toolArgs.timeoutMs || 6000
            });
          }

          // 3. Browser Seam
          else if (['search_web', 'fetch_web_page', 'extract_page_content'].includes(toolName) && ctx.has('browser')) {
            const browserService = ctx.get('browser');
            if (toolName === 'search_web') {
              result = await browserService.searchWeb(toolArgs.query);
            } else {
              result = await browserService.browseUrl(toolArgs.url);
            }
          }

          // 4. Subagents Seam
          else if (toolName === 'delegate_to_subagent' && ctx.has('subagents')) {
            const subagentsService = ctx.get('subagents');
            result = await subagentsService.invoke({
              personaId: toolArgs.persona_id,
              prompt: toolArgs.prompt
            });
          }

          // 5. Skills consultation
          else if (toolName === 'consult_skill') {
            result = axomSkills.executeSkillConsultation(toolArgs.skill_name);
          }

          // 6. Research skills
          else if (researchSkills && ['academic_search', 'generate_bibtex', 'build_literature_matrix', 'evaluate_research_gap', 'create_design_brief', 'conduct_paper_review'].includes(toolName)) {
            result = await researchSkills.executeResearchTool(toolName, toolArgs, process.cwd());
          }

          // 7. Fallback to browser execution
          else if (ctx.has('browser')) {
            const browserService = ctx.get('browser');
            result = await browserService.executeTool(toolName, toolArgs);
          } else {
            result = { success: false, error: `Unrecognized or unhandled tool: ${toolName}` };
          }

          const durationMs = Date.now() - startTime;
          ctx.emit('tool:success', { tool: toolName, result, durationMs });
          return result;
        } catch (err) {
          const durationMs = Date.now() - startTime;
          ctx.emit('tool:error', { tool: toolName, error: err.message, durationMs });
          return { success: false, error: err.message };
        }
      }
    };

    ctx.provide('consumer_tools', consumerToolsService);
  }
};

module.exports = ConsumerToolsPlugin;
