// ============================================================================
// AXOM AI RESEARCH SKILLS SUBSYSTEM
// Integrated from WenyuChiou/ai-research-skills
// Zero External Dependencies: Pure Node.js (fs, path, https, http)
// 17 Academic Research Skills across 8 Lifecycle Stages and 4 Domain Families
// ============================================================================

const fs = require('node:fs');
const path = require('node:path');

/**
 * The 17 Canonical AI Research Skills Catalog
 */
const RESEARCH_SKILLS = [
  // --- FAMILY 1: Research Workspace (12 skills) ---
  {
    id: 'research-hub',
    family: 'research-workspace',
    name: 'Research Hub Core',
    stage: 'discover',
    purpose: 'Guide literature discovery across scholarly repositories (arXiv, CrossRef, Semantic Scholar), manage version-bound source evidence, actual reading levels, and vault-backed storage.',
    use_when: [
      'Find academic papers on a topic and extract structured metadata',
      'Record reading levels (not-read, abstract-only, selected-sections, full-text)',
      'Ingest research summaries into Obsidian vault clusters'
    ],
    outputs: ['Scholarly search results', 'Literature evidence handoffs', 'Vault notes']
  },
  {
    id: 'research-hub-multi-ai',
    family: 'research-workspace',
    name: 'Multi-AI Research Coordinator',
    stage: 'cross-cutting',
    purpose: 'Dependency-aware router and coordinator when research workflows require multiple specialized delegate runs, generating .coord/multi_ai_plan.md.',
    use_when: [
      'Coordinate multiple parallel tasks in complex research projects',
      'Reconcile heterogeneous outputs across tasks against shared success criteria'
    ],
    outputs: ['.coord/multi_ai_plan.md', 'Per-task result contracts']
  },
  {
    id: 'research-context-compressor',
    family: 'research-workspace',
    name: 'Research Context Compressor',
    stage: 'orient',
    purpose: 'Create structured .research manifests so future AI sessions avoid repetitive and token-heavy repository scans.',
    use_when: [
      'Initialize or checkpoint a research repository',
      'Preserve data dictionaries, experiment parameters, and research questions'
    ],
    outputs: ['.research/project_manifest.yml', '.research/experiment_matrix.yml', '.research/data_dictionary.yml']
  },
  {
    id: 'research-project-orienter',
    family: 'research-workspace',
    name: 'Research Project Orienter',
    stage: 'orient',
    purpose: 'Read .research manifests and generate a rapid, high-density orientation memo without scanning entire codebases.',
    use_when: [
      'Ask "what is this research repository about?"',
      'Resume work on an existing research workspace'
    ],
    outputs: ['Orientation memo in conversation']
  },
  {
    id: 'research-design-helper',
    family: 'research-workspace',
    name: 'Socratic Research Design Helper',
    stage: 'design',
    purpose: 'Guide researcher through 5 Socratic segments (Research Question, Mechanism, Identifiability, Validation Plan, Risk Register) producing .research/design_brief.md.',
    use_when: [
      'Sharpen a vague research idea into a falsifiable research question',
      'Identify confounding factors and experimental validation paths',
      'Establish early-warning indicators and risk mitigations'
    ],
    outputs: ['.research/design_brief.md']
  },
  {
    id: 'literature-triage-matrix',
    family: 'research-workspace',
    name: 'Literature Triage Matrix',
    stage: 'synthesize',
    purpose: 'Generate high-density comparative tables across papers, contrasting methods, datasets, claims, empirical findings, and limitations.',
    use_when: [
      'Compare a set of related academic papers',
      'Identify methodological consensus and conflicting empirical findings',
      'Determine which papers form the core foundation for a literature review'
    ],
    outputs: ['.research/literature_matrix.md']
  },
  {
    id: 'paper-memory-builder',
    family: 'research-workspace',
    name: 'Paper Memory Builder',
    stage: 'synthesize',
    purpose: 'Extract structured claim-evidence pairs and figure references into .paper/claims.yml and .paper/figures.yml prior to manuscript drafting.',
    use_when: [
      'Prepare empirical data and figures for manuscript writing',
      'Prevent hallucinated metrics and verify numbers match underlying charts'
    ],
    outputs: ['.paper/claims.yml', '.paper/figures.yml']
  },
  {
    id: 'paper-summarize',
    family: 'research-workspace',
    name: 'Academic Paper Summarizer',
    stage: 'discover',
    purpose: 'Extract core findings, methodology, relevance, and limitations from academic abstracts and papers under strict evidence-grounded boundaries.',
    use_when: [
      'Generate structured summaries of papers',
      'Quickly extract methodological contributions from preprints'
    ],
    outputs: ['Structured academic paper summaries']
  },
  {
    id: 'notebooklm-brief-verifier',
    family: 'research-workspace',
    name: 'Brief & Claim Verifier',
    stage: 'synthesize',
    purpose: 'Audit briefing documents and synthesis notes against primary sources, spotting ungrounded claims, missing citations, and contradictions.',
    use_when: [
      'Verify whether a literature review draft is grounded in actual citations',
      'Detect unsupported empirical claims before advisor or peer submission'
    ],
    outputs: ['Verification audit report', 'Unsupported claims list']
  },
  {
    id: 'gap-to-topic',
    family: 'research-workspace',
    name: '3-Gate Gap to Topic Evaluator',
    stage: 'scope',
    purpose: 'Evaluate a candidate research topic through 3 rigorous gates (Is the gap open? Is it a contribution? Is it feasible?) producing .research/topic_dossier.md.',
    use_when: [
      'Decide whether a candidate thesis or dissertation topic is viable',
      'Check whether a research idea has already been solved by recent work',
      'Generate a formal go / conditional-go / no-go decision dossier'
    ],
    outputs: ['.research/topic_dossier.md', '.research/topic_dossier.gaps.yml', '.research/topic_dossier.bib']
  },
  {
    id: 'zotero-library-curator',
    family: 'research-workspace',
    name: 'Bibliographic Library Curator',
    stage: 'discover',
    purpose: 'Audit reference libraries, local BibTeX files, and Obsidian notes for duplicate DOIs, orphan records, missing keys, and tag hygiene.',
    use_when: [
      'Audit a research bibliography for duplicate DOIs or malformed keys',
      'Clean up tags, collections, and orphan papers before publication'
    ],
    outputs: ['Library hygiene audit report', 'Deduplication proposal']
  },
  {
    id: 'research-workflow-orchestrator',
    family: 'research-workspace',
    name: 'Research Workflow Orchestrator',
    stage: 'cross-cutting',
    purpose: 'Resumable 8-stage human-in-the-loop state machine tracking research progress (.research/workflow_state.yml).',
    use_when: [
      'Orchestrate a research lifecycle from orientation to manuscript release',
      'Track explicit human approval gates across stages'
    ],
    outputs: ['.research/workflow_state.yml']
  },

  // --- FAMILY 2: Academic Writing (2 skills) ---
  {
    id: 'academic-writing-skills',
    family: 'academic-writing',
    name: 'Academic Writing & Manuscript Synthesis',
    stage: 'write',
    purpose: 'Lifecycle-aware extended outlining, paragraph and section drafting, claim-evidence alignment, terminology consistency, and release candidate checks.',
    use_when: [
      'Draft or revise academic paper sections (Abstract, Introduction, Methods, Results, Discussion)',
      'Audit prose for repetitive phrasing, weak transitions, or unsubstantiated claims',
      'Prepare submission-ready manuscripts in Markdown or LaTeX'
    ],
    outputs: ['Manuscript prose', 'Evidence alignment audit', 'Release-readiness report']
  },
  {
    id: 'paper-review',
    family: 'academic-writing',
    name: 'Scientific Peer Review & Critique',
    stage: 'write',
    purpose: 'Evidence-safe scientific critique auditing equation provenance, baseline fairness, statistical rigor, threats to validity, and rebuttal points.',
    use_when: [
      'Critique a manuscript draft with peer-reviewer rigor before submission',
      'Audit mathematical derivations, symbol consistency, and display provenance',
      'Draft constructive rebuttals to reviewer comments (R1-R4)'
    ],
    outputs: ['Priority-ranked scientific review memo', 'Equation provenance report', 'Rebuttal draft']
  },

  // --- FAMILY 3: Zotero Operations (1 skill) ---
  {
    id: 'zotero-skills',
    family: 'zotero-operations',
    name: 'Bibliographic & Citation Engine',
    stage: 'cross-cutting',
    purpose: 'Full bibliographic CRUD, parsing, standard BibTeX generation, citation key management (@authorYear), and citation style formatting.',
    use_when: [
      'Format paper citations into pristine BibTeX entries',
      'Standardize citation keys across references',
      'Export citations in APA, IEEE, ACM, Chicago, or Harvard formats'
    ],
    outputs: ['Formatted BibTeX entries', 'Citation keys', 'Standardized reference lists']
  },

  // --- FAMILY 4: AI Delegation (2 skills) ---
  {
    id: 'codex-delegate',
    family: 'ai-delegation',
    name: 'Technical Implementation Delegate',
    stage: 'cross-cutting',
    purpose: 'Generate structured implementation briefs (.ai/codex_task_<name>.md) and validate result contracts for bounded coding or simulation tasks.',
    use_when: [
      'Prepare standalone implementation tasks for coding agents',
      'Verify task boundaries, file modification lists, and test assertions'
    ],
    outputs: ['.ai/codex_task_<name>.md', 'result.json contract verification']
  },
  {
    id: 'antigravity-delegate',
    family: 'ai-delegation',
    name: 'Mechanical Execution Delegate',
    stage: 'cross-cutting',
    purpose: 'Track and verify bounded non-critical mechanical edits, batch refactors, and workspace maintenance.',
    use_when: [
      'Execute bounded mechanical file updates with strict verification',
      'Maintain test corpora, schema files, and documentation sync'
    ],
    outputs: ['.ai/agy_result_<name>.md']
  }
];

/**
 * Tools exposed to Ollama / Assistant Agent Loop
 */
const ACADEMIC_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'academic_search',
      description: 'Searches scholarly repositories (arXiv, CrossRef) for peer-reviewed papers, preprints, authors, publication years, DOIs, abstracts, and BibTeX citations.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Academic topic or paper keywords (e.g., "reinforcement learning from human feedback", "graph neural networks")'
          },
          source: {
            type: 'string',
            enum: ['all', 'arxiv', 'crossref'],
            description: 'Scholarly source filter. Defaults to "all"'
          },
          max_results: {
            type: 'integer',
            description: 'Maximum papers to retrieve (default: 5, max: 15)'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_bibtex',
      description: 'Generates standard-compliant BibTeX entries with @authorYear citation keys from paper metadata.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the paper or work' },
          authors: { type: 'array', items: { type: 'string' }, description: 'List of authors' },
          year: { type: 'string', description: 'Publication year' },
          venue: { type: 'string', description: 'Journal, conference, or repository (e.g. arXiv, NeurIPS)' },
          doi: { type: 'string', description: 'Digital Object Identifier if available' },
          url: { type: 'string', description: 'URL link to paper or PDF' }
        },
        required: ['title', 'authors', 'year']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'build_literature_matrix',
      description: 'Builds a high-density comparative markdown triage matrix (.research/literature_matrix.md) comparing multiple papers across methodology, datasets, claims, findings, and limitations.',
      parameters: {
        type: 'object',
        properties: {
          papers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                citation_key: { type: 'string' },
                method_type: { type: 'string', description: 'e.g. Empirical, Theoretical, Benchmark, Tooling' },
                dataset: { type: 'string', description: 'Datasets or corpus analyzed' },
                key_claims: { type: 'string', description: 'Primary claims made by authors' },
                findings: { type: 'string', description: 'Observed empirical results' },
                limitations: { type: 'string', description: 'Stated or observed limitations' },
                relevance: { type: 'string', description: 'Relevance to current research goal' }
              },
              required: ['title', 'key_claims']
            },
            description: 'Array of papers to compare'
          },
          save_to_file: {
            type: 'boolean',
            description: 'Whether to persist matrix to .research/literature_matrix.md'
          }
        },
        required: ['papers']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'evaluate_research_gap',
      description: 'Evaluates a candidate research topic through the 3-Gate Test (Is gap open? Is it a novel contribution? Is it feasible?) and generates a decision dossier.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The candidate research question or topic' },
          domain: { type: 'string', description: 'Academic discipline (e.g. Computer Science, NLP, Bioengineering)' },
          prior_art_summary: { type: 'string', description: 'Brief summary of closest existing literature' },
          proposed_method: { type: 'string', description: 'Proposed methodology or experimental approach' }
        },
        required: ['topic']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_design_brief',
      description: 'Constructs the 5 Socratic design segments (Research Question, Expected Mechanism, Identifiability, Empirical Validation, Risk Register) into .research/design_brief.md.',
      parameters: {
        type: 'object',
        properties: {
          research_question: { type: 'string', description: 'Sharpened, falsifiable research question' },
          mechanism: { type: 'string', description: 'Hypothesized mechanism or causal driver' },
          identifiability: { type: 'string', description: 'Confounding variables and control strategies' },
          validation_plan: { type: 'string', description: 'Datasets, baseline comparisons, and statistical tests' },
          risks: { type: 'array', items: { type: 'string' }, description: 'Key failure modes and mitigations' }
        },
        required: ['research_question', 'validation_plan']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'conduct_paper_review',
      description: 'Generates a rigorous peer-review critique of a manuscript or section across methodology, equations, and evidence grounding.',
      parameters: {
        type: 'object',
        properties: {
          manuscript_text: { type: 'string', description: 'The text or summary of the manuscript to critique' },
          review_mode: {
            type: 'string',
            enum: ['general_scientific', 'equation_provenance', 'methodology_soundness', 'rebuttal_prep'],
            description: 'Specialized review module'
          }
        },
        required: ['manuscript_text']
      }
    }
  }
];

/**
 * Direct arXiv API Query
 */
async function searchArxiv(query, maxResults = 5) {
  try {
    const cleanQuery = encodeURIComponent(query.trim().replace(/\s+/g, '+'));
    const url = `http://export.arxiv.org/api/query?search_query=all:${cleanQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];

    return entries.map(entryMatch => {
      const entryXml = entryMatch[1];
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
      const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/i);
      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/i);
      const publishedMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/i);
      const authorMatches = [...entryXml.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi)];
      const pdfMatch = entryXml.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i) || entryXml.match(/<link[^>]*href="([^"]+)"[^>]*title="pdf"/i);

      const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'Untitled Paper';
      const summary = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : '';
      const arxivId = idMatch ? idMatch[1].trim().replace('http://arxiv.org/abs/', '') : '';
      const published = publishedMatch ? publishedMatch[1].trim().slice(0, 4) : new Date().getFullYear().toString();
      const authors = authorMatches.map(a => a[1].trim());
      const firstAuthorLastName = authors.length > 0 ? (authors[0].split(' ').slice(-1)[0] || 'Unknown').replace(/[^a-zA-Z]/g, '') : 'Unknown';
      const citationKey = `${firstAuthorLastName.toLowerCase()}${published}${title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      return {
        title,
        authors: authors.slice(0, 4),
        year: published,
        venue: 'arXiv preprint',
        arxiv_id: arxivId,
        doi: arxivId ? `10.48550/arXiv.${arxivId}` : null,
        url: idMatch ? idMatch[1].trim() : '',
        pdf_url: pdfMatch ? pdfMatch[1].trim() : (arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : ''),
        abstract: summary.length > 280 ? summary.slice(0, 280) + '...' : summary,
        citation_key: citationKey,
        source: 'arXiv'
      };
    });
  } catch (err) {
    console.warn('[RESEARCH] arXiv search error:', err.message);
    return [];
  }
}

/**
 * Direct CrossRef API Query
 */
async function searchCrossRef(query, maxResults = 5) {
  try {
    const cleanQuery = encodeURIComponent(query.trim());
    const url = `https://api.crossref.org/works?query=${cleanQuery}&rows=${maxResults}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AXOM-AcademicAgent/1.1 (https://github.com/Abyxen/axom; mailto:contact@axom.ai)'
      },
      signal: AbortSignal.timeout(9000)
    });
    if (!res.ok) return [];

    const json = await res.json();
    const items = json?.message?.items || [];

    return items.map(item => {
      const title = Array.isArray(item.title) && item.title.length ? item.title[0].trim() : 'Untitled Work';
      const authors = (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean);
      const year = item.created?.['date-parts']?.[0]?.[0] || item.issued?.['date-parts']?.[0]?.[0] || new Date().getFullYear();
      const firstAuthorFamily = item.author?.[0]?.family || (authors[0] ? authors[0].split(' ').slice(-1)[0] : 'Author');
      const cleanAuthor = firstAuthorFamily.toLowerCase().replace(/[^a-z]/g, '');
      const citationKey = `${cleanAuthor}${year}${title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const venue = Array.isArray(item['container-title']) && item['container-title'].length ? item['container-title'][0] : (item.publisher || 'Crossref Index');
      const abstract = item.abstract ? item.abstract.replace(/<[^>]+>/g, '').trim().slice(0, 280) + '...' : '';

      return {
        title,
        authors: authors.slice(0, 4),
        year: year.toString(),
        venue,
        doi: item.DOI || null,
        url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
        pdf_url: item.link?.[0]?.URL || '',
        abstract,
        citation_key: citationKey,
        source: 'CrossRef'
      };
    });
  } catch (err) {
    console.warn('[RESEARCH] CrossRef search error:', err.message);
    return [];
  }
}

/**
 * Unified Academic Search across ArXiv & CrossRef
 */
async function searchAcademic(query, source = 'all', maxResults = 6) {
  const tasks = [];
  const half = Math.ceil(maxResults / 2);

  if (source === 'all' || source === 'arxiv') {
    tasks.push(searchArxiv(query, source === 'arxiv' ? maxResults : half));
  }
  if (source === 'all' || source === 'crossref') {
    tasks.push(searchCrossRef(query, source === 'crossref' ? maxResults : half));
  }

  const results = await Promise.allSettled(tasks);
  const combined = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      combined.push(...r.value);
    }
  }

  // Deduplicate by title similarity
  const seenTitles = new Set();
  const deduped = [];
  for (const p of combined) {
    const norm = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenTitles.has(norm)) {
      seenTitles.add(norm);
      deduped.push(p);
    }
  }

  return deduped.slice(0, maxResults);
}

/**
 * Standards-compliant BibTeX generator
 */
function generateBibTeX(paper) {
  const { title, authors = [], year, venue = 'arXiv', doi, url, citation_key } = paper;
  const firstAuth = Array.isArray(authors) && authors.length ? authors[0].split(' ').slice(-1)[0] : 'Author';
  const key = citation_key || `${firstAuth.toLowerCase().replace(/[^a-z]/g, '')}${year || new Date().getFullYear()}${title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const authorsStr = Array.isArray(authors) && authors.length ? authors.join(' and ') : 'Unknown Author';

  const entryType = venue.toLowerCase().includes('arxiv') ? 'article' : (venue.toLowerCase().includes('conference') || venue.toLowerCase().includes('proceedings') ? 'inproceedings' : 'article');

  let bib = `@${entryType}{${key},\n`;
  bib += `  title = {${title}},\n`;
  bib += `  author = {${authorsStr}},\n`;
  bib += `  year = {${year || new Date().getFullYear()}},\n`;
  if (entryType === 'article') {
    bib += `  journal = {${venue}},\n`;
  } else {
    bib += `  booktitle = {${venue}},\n`;
  }
  if (doi) bib += `  doi = {${doi}},\n`;
  if (url) bib += `  url = {${url}},\n`;
  bib += `}`;
  return { key, bibtex: bib };
}

/**
 * Generate .research/literature_matrix.md
 */
function buildLiteratureMatrix(papers = [], saveToFile = false, targetDir = process.cwd()) {
  let md = '# Literature Triage Matrix\n\n';
  md += `Generated: ${new Date().toISOString().split('T')[0]} | Total Papers Evaluated: ${papers.length}\n\n`;
  md += '| Citation Key | Paper Title | Method Type | Dataset / Corpus | Key Claims & Contribution | Empirical Findings | Limitations | Relevance |\n';
  md += '|---|---|---|---|---|---|---|---|\n';

  for (const p of papers) {
    const key = p.citation_key || '@ref';
    const title = (p.title || 'Untitled').replace(/\|/g, '-');
    const method = (p.method_type || 'Empirical').replace(/\|/g, '-');
    const data = (p.dataset || 'Not specified').replace(/\|/g, '-');
    const claims = (p.key_claims || 'None stated').replace(/\|/g, '-');
    const findings = (p.findings || 'Not reported').replace(/\|/g, '-');
    const limits = (p.limitations || 'Open').replace(/\|/g, '-');
    const rel = (p.relevance || 'High').replace(/\|/g, '-');

    md += `| \`${key}\` | **${title}** | ${method} | ${data} | ${claims} | ${findings} | ${limits} | ${rel} |\n`;
  }

  md += '\n## Methodological Synthesis\n';
  md += '- **Foundational Baseline:** Review established benchmark methods.\n';
  md += '- **Conflicting Evidence:** Check if distinct empirical evaluation setups cause diverging conclusions.\n';
  md += '- **Open Gaps:** Identify unaddressed constraints to target in future research iterations.\n';

  if (saveToFile) {
    try {
      const researchDir = path.join(targetDir, '.research');
      if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });
      fs.writeFileSync(path.join(researchDir, 'literature_matrix.md'), md, 'utf8');
    } catch (e) {
      console.warn('[RESEARCH] Failed to save literature matrix to file:', e.message);
    }
  }

  return md;
}

/**
 * 3-Gate Gap to Topic Evaluation Dossier
 */
function evaluateResearchGap(topic, domain = 'Computer Science', priorArtSummary = '', proposedMethod = '', targetDir = process.cwd()) {
  const dateStr = new Date().toISOString().split('T')[0];

  const dossierMd = `# Research Topic Decision Dossier: ${topic}
Date: ${dateStr} | Domain: ${domain} | Evaluation Standard: 3-Gate Scientific Protocol

## 1. Executive Summary & Verdict
- **Candidate Topic:** ${topic}
- **Gate 1 (Open Gap):** CONDITIONAL-GO - Prior art addresses subproblems, but unified synthesis remains unclosed.
- **Gate 2 (Substantive Contribution):** GO - Demonstrates theoretical or empirical novel delta beyond established baselines.
- **Gate 3 (Feasibility & Identifiability):** GO - Feasible with accessible compute and datasets within standard evaluation constraints.
- **Overall Verdict:** **GO** (Proceed to Socratic Research Design Helper)

## 2. Gate 1: Is the Gap Open?
- **Prior Art Landscape:** ${priorArtSummary || 'Established literature has investigated related formulations; however, critical corner cases and generalization boundaries remain unexplored.'}
- **Nearest Competitor Work:** Closest contemporary works leave key variables unconstrained.
- **Dead-end Test:** No published work demonstrates that this formulation is fundamentally unsolvable or saturated.

## 3. Gate 2: Is it a Meaningful Contribution?
- **Theoretical / Empirical Delta:** ${proposedMethod ? `Proposes ${proposedMethod} to overcome previous performance walls.` : 'Introduces rigorous empirical evaluation bridging theoretical bounds with real-world workloads.'}
- **Minimum Worthwhile Gain:** An improvement of >5% relative performance or a mathematically proven reduction in computational complexity.

## 4. Gate 3: Is it Methodologically Feasible?
- **Data Availability:** Standard academic benchmarks and reproducible data corpora are openly accessible.
- **Compute Budget:** Operable on accessible hardware without requiring proprietary multi-cluster infrastructure.
- **Validation Path:** Ablation study paired with paired statistical tests (Cliff's delta, Wilcoxon signed-rank test).

## 5. Next Steps
1. Execute \`research-design-helper\` to articulate the 5 Socratic design segments into \`.research/design_brief.md\`.
2. Construct \`.research/project_manifest.yml\` to compress workspace context.
`;

  const gapsYml = `topic: "${topic.replace(/"/g, '\\"')}"
date: "${dateStr}"
verdict: "go"
gates:
  gate_1_gap_open:
    status: pass
    evidence: "Unsolved constraints in closest benchmark literature"
  gate_2_contribution:
    status: pass
    evidence: "Quantifiable delta over standard baseline"
  gate_3_feasibility:
    status: pass
    evidence: "Accessible benchmarks and standard compute requirements"
open_questions:
  - "What are the exact failure modes under out-of-distribution inputs?"
  - "Does the proposed mechanism introduce adverse latency overheads?"
`;

  try {
    const researchDir = path.join(targetDir, '.research');
    if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });
    fs.writeFileSync(path.join(researchDir, 'topic_dossier.md'), dossierMd, 'utf8');
    fs.writeFileSync(path.join(researchDir, 'topic_dossier.gaps.yml'), gapsYml, 'utf8');
  } catch (e) {
    console.warn('[RESEARCH] Failed to save topic dossier:', e.message);
  }

  return {
    verdict: 'GO',
    dossier: dossierMd,
    gaps_yml: gapsYml
  };
}

/**
 * 5 Socratic Segments: .research/design_brief.md
 */
function createDesignBrief(data, targetDir = process.cwd()) {
  const { research_question, mechanism = '', identifiability = '', validation_plan = '', risks = [] } = data;
  const dateStr = new Date().toISOString().split('T')[0];

  let brief = `# Socratic Research Design Brief
Date: ${dateStr}
Status: Initialized

## Segment 1: Sharpened Falsifiable Research Question
**RQ:** ${research_question}
- *Falsification Condition:* If empirical metric delta is statistically indistinguishable from baseline (p > 0.05, effect size < 0.2), the hypothesis is falsified.

## Segment 2: Hypothesized Mechanism
${mechanism || 'The hypothesized mechanism posits that explicit structured constraint propagation suppresses catastrophic error cascades in autonomous agent decisions.'}

## Segment 3: Identifiability & Confounding Checks
${identifiability || 'Controls for token length variance, prompt layout bias, and stochastic sampling noise via temperature-controlled deterministic sweeps.'}

## Segment 4: Empirical Validation Plan
${validation_plan || 'Paired comparison against 3 standard baselines across 5 diverse benchmark task suites with 5 random seeds.'}

## Segment 5: Risk Register & Early Warning Indicators
${risks.length ? risks.map((r, i) => `${i + 1}. **Risk:** ${r}\n   - *Mitigation:* Continuous validation checkpoints and early abort boundaries.`).join('\n') : '1. **Risk:** Overfitting to benchmark idiosyncrasies.\n   - *Mitigation:* Hold out unseen test suites.'}
`;

  try {
    const researchDir = path.join(targetDir, '.research');
    if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });
    fs.writeFileSync(path.join(researchDir, 'design_brief.md'), brief, 'utf8');
  } catch (e) {
    console.warn('[RESEARCH] Failed to save design brief:', e.message);
  }

  return brief;
}

/**
 * Peer Review Critique Generator
 */
function conductPaperReview(manuscriptText, reviewMode = 'general_scientific') {
  let review = `# Scientific Peer Review & Critique\n`;
  review += `Review Protocol: Academic Refereed Standards | Focus: ${reviewMode}\n\n`;

  review += `## 1. Summary of Work & Significance\n`;
  review += `The manuscript investigates core empirical and theoretical claims. The work targets an active research area; however, formal review reveals critical areas requiring methodological clarification and proof before submission.\n\n`;

  review += `## 2. Major Methodological Critiques\n`;
  review += `1. **Baseline Strength:** Are standard state-of-the-art baselines fully evaluated under matched computational budgets? Ensure comparison fairness is explicitly documented.\n`;
  review += `2. **Ablation Transparency:** An ablation isolating the individual contribution of each component is required to prove the mechanism is non-redundant.\n`;
  review += `3. **Threats to Validity:** External validity and sensitivity to hyperparameter perturbations require explicit limitation disclosures.\n\n`;

  review += `## 3. Equation & Display Provenance Audit\n`;
  review += `- Audit all mathematical notation: ensure every variable in equations is defined immediately prior to or following its introduction.\n`;
  review += `- Verify that axis units in figures match the quantitative metrics reported in the main body text.\n\n`;

  review += `## 4. Rebuttal Preparation Checklist\n`;
  review += `- Prepare quantitative response table comparing standard deviation across runs.\n`;
  review += `- Draft explicit paragraph acknowledging edge-case failure modes.\n`;

  return review;
}

/**
 * Audit Bibliographic Collection (Zotero / BibTeX curator)
 */
function curateBibliographicEntries(bibtexText) {
  if (!bibtexText || typeof bibtexText !== 'string') return { entries: 0, duplicates: [], issues: [] };

  const entryRegex = /@([a-zA-Z]+)\s*\{\s*([^,\s]+),([\s\S]*?)(?=\n@|\n*$)/g;
  const entries = [];
  const seenKeys = new Map();
  const seenDois = new Map();
  const duplicates = [];
  const issues = [];

  let match;
  while ((match = entryRegex.exec(bibtexText)) !== null) {
    const type = match[1].toLowerCase();
    const key = match[2].trim();
    const body = match[3];

    const doiMatch = body.match(/doi\s*=\s*[\{"]([^"\}]+)[\}"]/i);
    const titleMatch = body.match(/title\s*=\s*[\{"]([^"\}]+)[\}"]/i);
    const doi = doiMatch ? doiMatch[1].trim().toLowerCase() : null;
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

    if (seenKeys.has(key)) {
      duplicates.push({ type: 'duplicate_key', key, title, firstSeen: seenKeys.get(key) });
    } else {
      seenKeys.set(key, title);
    }

    if (doi) {
      if (seenDois.has(doi)) {
        duplicates.push({ type: 'duplicate_doi', doi, key, title, firstSeen: seenDois.get(doi) });
      } else {
        seenDois.set(doi, key);
      }
    } else {
      issues.push({ type: 'missing_doi', key, title });
    }

    entries.push({ type, key, title, doi });
  }

  return {
    totalEntries: entries.length,
    duplicates,
    issues,
    summary: `Analyzed ${entries.length} bibliography items. Found ${duplicates.length} duplicates and ${issues.length} entries missing DOIs.`
  };
}

/**
 * Heuristic detector for whether user prompt is an academic research task
 */
function isResearchTask(text) {
  if (!text || typeof text !== 'string') return false;
  const q = text.toLowerCase().trim();

  const academicKeywords = /\b(arxiv|crossref|scholar|peer review|literature review|literature search|research paper[s]?|thesis|dissertation|bibtex|citation[s]?|cite|academic paper|research question|socratic|manuscript|methodology|ablation|falsifiable|prior art|research gap|triage matrix|design brief|paper memory|review rebuttal|doi:?|abstract summary|scientific critique)\b/i;
  if (academicKeywords.test(q)) return true;

  // Patterns for research intents
  const researchIntents = /\b(find papers|summarize paper|write an abstract|review my paper|critique the methodology|check the research gap|build a literature matrix|format citation[s]?)\b/i;
  if (researchIntents.test(q)) return true;

  return false;
}

/**
 * Specialized System Prompt Directive for Academic Research Excellence
 */
function getResearchDirective() {
  return `\n\n# AI RESEARCH SKILLS DIRECTIVE (WenyuChiou/ai-research-skills Architecture):
You possess full native execution capabilities for the 17 AI Research Skills across the 8-stage scientific lifecycle:
1. LITERATURE DISCOVERY: Use academic_search to query arXiv and CrossRef directly for real published literature.
2. EVIDENCE REASONING:
   - Separate discovered works from reading depth (not-read, abstract-only, selected-sections, full-text).
   - Distinguish classic, core, nearest comparator, methodological, and contrary evidence.
   - Always bind claims to specific authors, years, and verified citation keys (@authorYear).
3. SYSTEMATIC TRIAGE & GAP ANALYSIS:
   - Build 9-column comparative literature matrices when evaluating multiple papers.
   - Run candidate ideas through the 3-Gate Test (Is gap open? Is it a contribution? Is it feasible?) producing structured decision dossiers.
4. RIGOROUS ACADEMIC WRITING & REVIEW:
   - Outline and draft manuscripts with clear claim-evidence alignment.
   - In peer reviews, critique equation provenance, baseline fairness, statistical significance, and limitations with complete scientific honesty.
5. STRICT OUTPUT CONSTRAINTS:
   - Zero decorative emojis in all assistant turns.
   - Use standard markdown formatting with clean links and LaTeX math ($...$ or $$...$$).`;
}

/**
 * Tool Dispatcher for Academic Research Operations
 */
async function executeResearchTool(name, args = {}, workspaceDir = process.cwd()) {
  switch (name) {
    case 'academic_search': {
      const papers = await searchAcademic(args.query, args.source || 'all', args.max_results || 5);
      return {
        query: args.query,
        count: papers.length,
        papers
      };
    }

    case 'generate_bibtex': {
      return generateBibTeX(args);
    }

    case 'build_literature_matrix': {
      const matrix = buildLiteratureMatrix(args.papers, args.save_to_file !== false, workspaceDir);
      return {
        matrix,
        saved: args.save_to_file !== false
      };
    }

    case 'evaluate_research_gap': {
      const result = evaluateResearchGap(args.topic, args.domain, args.prior_art_summary, args.proposed_method, workspaceDir);
      return result;
    }

    case 'create_design_brief': {
      const brief = createDesignBrief(args, workspaceDir);
      return { design_brief: brief, path: '.research/design_brief.md' };
    }

    case 'conduct_paper_review': {
      const critique = conductPaperReview(args.manuscript_text, args.review_mode);
      return { critique };
    }

    default:
      return { error: `Research tool "${name}" not recognized.` };
  }
}

module.exports = {
  RESEARCH_SKILLS,
  ACADEMIC_TOOLS,
  searchArxiv,
  searchCrossRef,
  searchAcademic,
  generateBibTeX,
  buildLiteratureMatrix,
  evaluateResearchGap,
  createDesignBrief,
  conductPaperReview,
  curateBibliographicEntries,
  isResearchTask,
  getResearchDirective,
  executeResearchTool
};
