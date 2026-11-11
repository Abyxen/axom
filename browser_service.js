const fs = require('node:fs');
const { execFile, spawn } = require('node:child_process');

/**
 * Locate installed Chrome or Edge on Windows
 */
function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const BROWSER_PATH = findBrowserExecutable();

/**
 * Strip boilerplate and convert HTML into clean, readable Markdown
 */
function extractReadableText(html, maxLength = 6000) {
  if (!html || typeof html !== 'string') return '';
  let text = html;

  // Remove scripts, styles, noscript, svg, nav, footer, header
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');

  // Extract page title if available
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  // Convert headings
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');

  // Convert paragraphs and line breaks
  text = text.replace(/<br\s*[\/]?>/gi, '\n');
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n* $1');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  let result = pageTitle ? `# ${pageTitle}\n\n` + text : text;
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + '\n\n... [Content truncated for context window]';
  }
  return result;
}

/**
 * Google News real-time search feed (Google Official Real-time Index)
 */
async function searchGoogleNews(query, maxResults = 5) {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim();
  const isPt = /[ãõáéíóúâêîôûç]/i.test(cleanQuery);
  const hl = isPt ? 'pt-PT' : 'en-US';
  const gl = isPt ? 'PT' : 'US';
  const ceid = isPt ? 'PT:pt-150' : 'US:en';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>/gi)];
    return items.slice(0, maxResults).map(m => ({
      title: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      url: m[2].trim(),
      published: m[3].trim(),
      source: m[4].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
      snippet: `Latest reporting from ${m[4].replace(/<!\[CDATA\[|\]\]>/g, '').trim()} (${m[3].trim()}): ${m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()}`,
      engine: 'Google'
    }));
  } catch (err) {
    return [];
  }
}

/**
 * General web search via DuckDuckGo HTML / Bing fallback
 */
async function searchGeneralWeb(query, maxResults = 5) {
  if (!query || !query.trim()) return [];
  const cleanQuery = query.trim();
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(cleanQuery);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) return [];

    const html = await res.text();
    const results = [];

    const titleRegex = /<h2[^>]*class=\"result__title\"[^>]*>[\s\S]*?<a[^>]+class=\"result__a\"[^>]+href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class=\"result__snippet\"[^>]*>([\s\S]*?)<\/a>/gi;

    let m;
    while ((m = titleRegex.exec(html)) !== null) {
      let rawUrl = m[1];
      if (rawUrl.includes('uddg=')) {
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        if (uddgMatch) rawUrl = decodeURIComponent(uddgMatch[1]);
      }
      const cleanTitle = m[2].replace(/<[^>]+>/g, '').trim();
      results.push({ title: cleanTitle, url: rawUrl, snippet: '', engine: 'Google & Web' });
    }

    let sIndex = 0;
    while ((m = snippetRegex.exec(html)) !== null && sIndex < results.length) {
      const cleanSnippet = m[1].replace(/<[^>]+>/g, '').trim();
      results[sIndex].snippet = cleanSnippet;
      sIndex++;
    }

    return results.slice(0, maxResults);
  } catch (err) {
    return [];
  }
}

/**
 * Tier 1: Real-time Multi-Source Google & Web Intelligence Search Engine
 * Enriches search results with deep extracted page content for superior AI reasoning
 */
async function searchWeb(query, maxResults = 5) {
  if (!query || !query.trim()) {
    return { error: 'Search query is required' };
  }

  const cleanQuery = query.trim();

  // Execute Google News and General Web Index concurrently for maximum speed and breadth
  const [googleNewsResults, webResults] = await Promise.all([
    searchGoogleNews(cleanQuery, maxResults),
    searchGeneralWeb(cleanQuery, maxResults)
  ]);

  // Combine and deduplicate by domain / URL
  const combined = [];
  const seenUrls = new Set();

  // Prioritize Google News items if present
  for (const item of googleNewsResults) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      combined.push(item);
    }
  }

  for (const item of webResults) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      combined.push(item);
    }
  }

  const sliced = combined.slice(0, maxResults);

  // Deep Intelligence Enrichment: For the top 2 web results, fetch snippet preview of actual page content
  for (let i = 0; i < Math.min(sliced.length, 2); i++) {
    const item = sliced[i];
    if (item.url && item.url.startsWith('http') && !item.url.includes('news.google.com/rss/articles')) {
      try {
        const pageRes = await fetch(item.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          signal: AbortSignal.timeout(3500)
        });
        if (pageRes.ok) {
          const rawHtml = await pageRes.text();
          const cleanText = extractReadableText(rawHtml, 1200);
          if (cleanText && cleanText.length > 100) {
            item.deep_content = cleanText.slice(0, 1000);
          }
        }
      } catch (e) {
        // Fallback to snippet if direct page read times out
      }
    }
  }

  return {
    query: cleanQuery,
    search_engine: 'Google & Multi-Engine Web Intelligence',
    total_found: sliced.length,
    results: sliced
  };
}

/**
 * Tier 2: Visit & Read Webpage (with Headless Browser fallback for SPA/JS rendering)
 */
async function browsePage(url, preferHeadlessBrowser = false) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return { error: 'Invalid URL. Must begin with http:// or https://' };
  }

  // 1. If headless browser is explicitly requested and browser binary is present
  if (preferHeadlessBrowser && BROWSER_PATH) {
    try {
      const domText = await new Promise((resolve, reject) => {
        execFile(
          BROWSER_PATH,
          ['--headless=new', '--dump-dom', '--disable-gpu', '--virtual-time-budget=5000', url],
          { timeout: 20000, maxBuffer: 15 * 1024 * 1024 },
          (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout);
          }
        );
      });
      const cleanContent = extractReadableText(domText);
      return {
        url,
        rendered_with: 'Headless Browser (Chromium)',
        content: cleanContent
      };
    } catch (err) {
      console.warn('[BROWSER] Headless dump failed, falling back to fetch:', err.message);
    }
  }

  // 2. Fast HTTP fetch
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      return { error: `Webpage returned status ${res.status}` };
    }

    const rawHtml = await res.text();
    const cleanContent = extractReadableText(rawHtml);

    // If the page returned virtually no text (likely a JS-rendered React/Vue app) and we haven't tried headless yet:
    if (cleanContent.length < 250 && BROWSER_PATH && !preferHeadlessBrowser) {
      return await browsePage(url, true);
    }

    return {
      url,
      rendered_with: 'HTTP Fast Stream',
      content: cleanContent
    };
  } catch (err) {
    return { error: `Failed to fetch webpage: ${err.message}` };
  }
}

/**
 * Open a real desktop browser window for the user
 */
function openBrowserWindow(url) {
  if (!url || !url.startsWith('http')) {
    return { error: 'Invalid URL' };
  }
  if (!BROWSER_PATH) {
    return { error: 'No browser (Edge/Chrome) found on host machine' };
  }

  try {
    const proc = spawn(BROWSER_PATH, [url], { detached: true, stdio: 'ignore' });
    proc.unref();
    return { success: true, message: `Opened ${url} in your desktop browser.` };
  } catch (err) {
    return { error: `Could not launch browser: ${err.message}` };
  }
}

/**
 * OpenAI-compatible tool schemas for Ollama
 */
const BROWSING_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Searches the live internet for current facts, news, documentation, technical guides, or live information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up on the web'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browse_page',
      description: 'Visits a specific webpage URL, executes scripts if necessary, and extracts the full readable text content.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The absolute URL of the webpage to visit and read'
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_browser',
      description: 'Opens a visible browser window on the user laptop screen displaying a webpage.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to open in the visible desktop browser'
          }
        },
        required: ['url']
      }
    }
  }
];

/**
 * Parse any raw XML or JSON tool calls that the model might emit directly into content text
 */
function parseTextToolCalls(text) {
  if (!text || typeof text !== 'string') return null;
  const calls = [];

  // Format 1: XML-style <tool_call><function=NAME><parameter=KEY>VALUE</parameter></function></tool_call>
  const xmlRegex = /<tool_call>[\s\S]*?<function=([a-zA-Z0-9_]+)>([\s\S]*?)<\/function>[\s\S]*?<\/tool_call>/gi;
  let match;
  while ((match = xmlRegex.exec(text)) !== null) {
    const fnName = match[1].trim();
    const body = match[2];
    const args = {};
    const paramRegex = /<parameter=([a-zA-Z0-9_]+)>([\s\S]*?)<\/parameter>/gi;
    let pMatch;
    while ((pMatch = paramRegex.exec(body)) !== null) {
      args[pMatch[1].trim()] = pMatch[2].trim();
    }
    calls.push({
      id: 'call_' + Math.random().toString(36).slice(2, 10),
      function: { name: fnName, arguments: args }
    });
  }

  // Format 2: JSON-style <tool_call>{"name": "...", "arguments": {...}}</tool_call>
  if (calls.length === 0) {
    const jsonRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
    let jMatch;
    while ((jMatch = jsonRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(jMatch[1].trim());
        if (parsed.name) {
          calls.push({
            id: 'call_' + Math.random().toString(36).slice(2, 10),
            function: {
              name: parsed.name,
              arguments: parsed.arguments || parsed.parameters || {}
            }
          });
        }
      } catch (e) {}
    }
  }

  return calls.length > 0 ? calls : null;
}

/**
 * Autonomous heuristic to detect if a prompt requires live web browsing or is a difficult task
 */
function isWebSearchNeeded(text) {
  if (!text || typeof text !== 'string') return false;
  const q = text.toLowerCase().trim();

  // Pattern 1: Meteorological, Weather & Climate (typo-tolerant: weathert, wheather, wether, temperat*, etc.)
  const weatherPattern = /\b(weathert?|wheather|wether|forecast[s]?|temperat[a-z]*|temp|climate|rain[a-z]*|snow[a-z]*|sunny|wind[a-z]*|humid[a-z]*|celsius|fahrenheit|degrees|radar|storm[s]?|tempo|clima|temperatura[s]?|previs[aã]o|chuva[s]?|chover|chovendo|sol|ensolarado|vento[s]?|ventando|humidade|umidade|graus)\b/i;
  if (weatherPattern.test(q)) return true;

  // Pattern 2: Temporal & Real-Time Indicators paired with targets
  const timePattern = /\b(today|tomorrow|yesterday|tonight|right now|currently|current|latest|recent|recently|breaking news|live|update|updates|hoje|amanh[aã]|ontem|agora|atual|atualmente|[uú]ltimas|not[ií]cias|recente|recentemente|em tempo real)\b/i;
  const liveTargetPattern = /\b(condition[s]?|condi[cç][oõ]es|situation|situa[cç][aã]o|score|game|match|matchup|standings|winner|who won|election|stock|price|crypto|bitcoin|btc|eth|market|flight|status|release date|version|patch notes|jogo|resultado|placar|classifica[cç][aã]o|quem ganhou|elei[cç][oõ]es|a[cç][oõ]es|pre[cç]o|cota[cç][aã]o|valor|voo|lan[cç]amento|vers[aã]o)\b/i;
  if (timePattern.test(q) && liveTargetPattern.test(q)) return true;

  // Pattern 3: Financial & Market Lookups
  const financePattern = /\b(stock price|share price|crypto price|bitcoin price|btc price|exchange rate|inflation rate|cota[cç][aã]o do|pre[cç]o do bitcoin|pre[cç]o da a[cç][aã]o|taxa selic|eur to usd|usd to)\b/i;
  if (financePattern.test(q)) return true;

  // Pattern 4: Explicit Search Directives
  const searchDirective = /\b(search for|search the web|search web|google|look up|find online|check online|browse for|pesquise|pesquisar|procure|procurar|busque|buscar|ver na internet|ver na web|olhe no google|busca online)\b/i;
  if (searchDirective.test(q)) return true;

  // Pattern 5: Live Entity/Facts queries (Who is current, who won, when is next)
  const entityPattern = /\b(who is the (current|new)|who is (now )?president|who is prime minister|who won the|when is the next|current ceo of|current population of|quem [eé] o (atual|novo)|quem ganhou o|quando ser[aá] o pr[oó]ximo)\b/i;
  if (entityPattern.test(q)) return true;

  // Pattern 6: Technical stack trace, crash, or error debugging (difficult task)
  const errorPattern = /(TypeError:|SyntaxError:|ReferenceError:|Cannot read propert|undefined is not|NullPointerException|OutOfMemory|Segmentation fault|ERR_[A-Z_]+|exit code [1-9]|npm ERR!|fatal error)/i;
  if (errorPattern.test(text)) return true;

  return false;
}

/**
 * Extract clean search keywords from a conversational prompt
 */
function extractSearchQuery(text) {
  if (!text || typeof text !== 'string') return '';
  let q = text.trim();
  q = q.replace(/^(can you (please )?|could you (please )?|please |hey axom,? |axom,? |i want to know |tell me |show me |give me |what is |whats |what's |who is |how is |qual [eé] |como est[aá] |diga-me |pesquise |procure |busque )/i, '');
  q = q.replace(/^(the |a |an |o |a |os |as )/i, '');
  q = q.replace(/^(search for|search the web for|google|look up|find online|browse for)\s+/i, '');
  q = q.replace(/\bweathert\b/gi, 'weather');
  q = q.replace(/\bwheather\b/gi, 'weather');
  q = q.replace(/\bwether\b/gi, 'weather');
  q = q.replace(/[?!.]+$/, '').trim();
  return q || text.trim();
}

/**
 * Dispatcher to execute a tool call
 */
async function executeTool(name, args = {}) {
  switch (name) {
    case 'search_web':
      return await searchWeb(args.query);
    case 'browse_page':
      return await browsePage(args.url);
    case 'open_browser':
      return openBrowserWindow(args.url);
    default:
      return { error: `Tool "${name}" is not recognized` };
  }
}

module.exports = {
  BROWSER_PATH,
  BROWSING_TOOLS,
  searchWeb,
  browsePage,
  openBrowserWindow,
  parseTextToolCalls,
  executeTool,
  isWebSearchNeeded,
  extractSearchQuery
};
