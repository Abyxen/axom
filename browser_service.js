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
 * Tier 1: Real-time Web Search via DuckDuckGo
 */
async function searchWeb(query, maxResults = 5) {
  if (!query || !query.trim()) {
    return { error: 'Search query is required' };
  }

  const cleanQuery = query.trim();
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(cleanQuery);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      return { error: `Search engine returned status ${res.status}` };
    }

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
      results.push({ title: cleanTitle, url: rawUrl, snippet: '' });
    }

    let sIndex = 0;
    while ((m = snippetRegex.exec(html)) !== null && sIndex < results.length) {
      const cleanSnippet = m[1].replace(/<[^>]+>/g, '').trim();
      results[sIndex].snippet = cleanSnippet;
      sIndex++;
    }

    const sliced = results.slice(0, maxResults);
    return {
      query: cleanQuery,
      total_found: sliced.length,
      results: sliced
    };
  } catch (err) {
    return { error: `Failed to search web: ${err.message}` };
  }
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
  executeTool
};
