const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const WORKSPACE_DIR = path.join(__dirname, 'workspace');
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const VISION_MODEL = 'moondream';

if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

/**
 * 1. Zero-dependency Pure Node.js PDF Text Extractor
 */
function parsePdf(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  const pdfStr = buffer.toString('binary');
  const metadata = {};

  // Extract Info dict metadata if present
  const infoMatch = pdfStr.match(/\/Title\s*\(([^)]+)\)/i);
  if (infoMatch) metadata.title = infoMatch[1];
  const authorMatch = pdfStr.match(/\/Author\s*\(([^)]+)\)/i);
  if (authorMatch) metadata.author = authorMatch[1];

  const extractedPages = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let streamCount = 0;

  while ((match = streamRegex.exec(pdfStr)) !== null) {
    streamCount++;
    const rawStream = Buffer.from(match[1], 'binary');
    let decodedText = '';

    // Attempt FlateDecode decompression
    try {
      const inflated = zlib.inflateSync(rawStream);
      decodedText = inflated.toString('latin1');
    } catch (e1) {
      try {
        const inflatedRaw = zlib.inflateRawSync(rawStream);
        decodedText = inflatedRaw.toString('latin1');
      } catch (e2) {
        decodedText = rawStream.toString('latin1');
      }
    }

    // Extract text blocks inside BT (Begin Text) ... ET (End Text)
    if (decodedText.includes('BT') && decodedText.includes('ET')) {
      const textChunks = [];
      const btRegex = /BT([\s\S]*?)ET/g;
      let btMatch;

      while ((btMatch = btRegex.exec(decodedText)) !== null) {
        const block = btMatch[1];

        // 1. Array text operator: [(Hello) 20 (World)] TJ
        const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
        let tjArrayMatch;
        while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
          const items = tjArrayMatch[1];
          const innerStrRegex = /\(([^)]*)\)/g;
          let sMatch;
          let combined = '';
          while ((sMatch = innerStrRegex.exec(items)) !== null) {
            combined += cleanPdfString(sMatch[1]);
          }
          if (combined.trim()) textChunks.push(combined.trim());
        }

        // 2. Single text operator: (Hello World) Tj or ' or "
        const tjSingleRegex = /\(([^)]*)\)\s*(?:Tj|'|")/g;
        let tjMatch;
        while ((tjMatch = tjSingleRegex.exec(block)) !== null) {
          const str = cleanPdfString(tjMatch[1]);
          if (str.trim()) textChunks.push(str.trim());
        }

        // 3. Hex string operator: <48656C6C6F> Tj
        const hexRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
        let hexMatch;
        while ((hexMatch = hexRegex.exec(block)) !== null) {
          const hex = hexMatch[1];
          let str = '';
          for (let i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
          }
          if (str.trim()) textChunks.push(str.trim());
        }
      }

      if (textChunks.length > 0) {
        extractedPages.push(textChunks.join(' '));
      }
    }
  }

  let finalContent = extractedPages.join('\n\n');
  if (!finalContent.trim()) {
    // Fallback: extract any ASCII string sequences longer than 4 chars
    const rawMatches = pdfStr.match(/[A-Za-z0-9 ,.;:!?'"()/\-_]{5,}/g);
    if (rawMatches && rawMatches.length > 0) {
      finalContent = rawMatches.filter(s => !s.startsWith('/Font') && !s.startsWith('/Length')).join(' ');
    }
  }

  return {
    type: 'pdf',
    metadata,
    streamCount,
    text: finalContent.trim() || 'No text extracted (document may consist exclusively of scanned images).'
  };
}

function cleanPdfString(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (match, octal) => String.fromCharCode(parseInt(octal, 8)));
}

/**
 * 2. Multi-Modal Vision Parser (Images: PNG, JPG, WEBP, GIF, BMP, SVG)
 */
async function parseImage(buffer, mimeType = 'image/png', filename = 'image.png', userPrompt = '') {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  const base64Data = buffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Data}`;

  // Read dimensions from header
  let dimensions = 'Unknown';
  try {
    if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50) { // PNG
      const w = buffer.readUInt32BE(16);
      const h = buffer.readUInt32BE(20);
      dimensions = `${w}x${h}px`;
    } else if (buffer.length > 10 && buffer[0] === 0xff && buffer[1] === 0xd8) { // JPEG
      dimensions = `JPEG (${Math.round(buffer.length / 1024)} KB)`;
    } else if (buffer.length > 6 && buffer.toString('ascii', 0, 3) === 'GIF') { // GIF
      const w = buffer.readUInt16LE(6);
      const h = buffer.readUInt16LE(8);
      dimensions = `${w}x${h}px`;
    }
  } catch (e) {}

  // Run Vision model via Ollama
  let visionAnalysis = '';
  try {
    const promptText = userPrompt
      ? `Analyze this image in detail and answer: ${userPrompt}\nExtract any text, code, numbers, diagrams, or visual layout accurately.`
      : `Provide a detailed, structured visual description of this image. Extract all legible text, code, labels, colors, and layout components.`;

    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        prompt: promptText,
        images: [base64Data],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1024
        }
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (res.ok) {
      const data = await res.json();
      visionAnalysis = data.response || '';
    }
  } catch (err) {
    console.warn('[FILE_SERVICE] Vision analysis fallback:', err.message);
  }

  return {
    type: 'image',
    filename,
    mimeType,
    dimensions,
    sizeBytes: buffer.length,
    dataUri,
    visionAnalysis: visionAnalysis.trim() || 'Visual metadata processed. Image base64 available for downstream synthesis.'
  };
}

/**
 * 3. Office Document Parser (.docx, .xlsx, .pptx)
 */
function parseOfficeDoc(buffer, ext = '.docx') {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);

  try {
    // Search for XML content inside uncompressed ZIP streams
    const bufStr = buffer.toString('binary');
    const xmlMatches = bufStr.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (xmlMatches && xmlMatches.length > 0) {
      const text = xmlMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      return {
        type: 'office_doc',
        ext,
        text: text.trim()
      };
    }

    // Fallback: extract plain text chunks
    const textChunks = buffer.toString('utf8').match(/[\w\s.,;:?!'"]{6,}/g) || [];
    return {
      type: 'office_doc',
      ext,
      text: textChunks.slice(0, 50).join('\n')
    };
  } catch (err) {
    return { type: 'office_doc', ext, text: `Error reading ${ext} document: ${err.message}` };
  }
}

/**
 * 4. General Master File Ingestor
 */
async function processUploadedFile(fileObj, userPrompt = '') {
  const { name, data, type } = fileObj;
  const ext = path.extname(name || '').toLowerCase();
  let buffer;

  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (typeof data === 'string' && data.startsWith('data:')) {
    const base64Index = data.indexOf(';base64,');
    if (base64Index !== -1) {
      buffer = Buffer.from(data.slice(base64Index + 8), 'base64');
    } else {
      buffer = Buffer.from(data, 'utf8');
    }
  } else if (typeof data === 'string') {
    try {
      buffer = Buffer.from(data, 'base64');
    } catch (e) {
      buffer = Buffer.from(data, 'utf8');
    }
  } else {
    buffer = Buffer.from('');
  }

  // Route by type
  if (ext === '.pdf' || (type && type.includes('pdf'))) {
    const parsed = parsePdf(buffer);
    return {
      name,
      ext: '.pdf',
      type: 'pdf',
      summary: `[PDF Document: ${name} (${parsed.streamCount} streams)]`,
      content: parsed.text,
      preview: parsed.text.slice(0, 300)
    };
  }

  const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
  if (imageExts.includes(ext) || (type && type.startsWith('image/'))) {
    const mime = type || `image/${ext.replace('.', '')}`;
    const parsed = await parseImage(buffer, mime, name, userPrompt);
    return {
      name,
      ext,
      type: 'image',
      dataUri: parsed.dataUri,
      summary: `[Image File: ${name} (${parsed.dimensions})]`,
      content: `# [Image Analysis & OCR: ${name}]\n**Dimensions**: ${parsed.dimensions}\n\n**Visual Content & Extracted Text**:\n${parsed.visionAnalysis}`,
      preview: parsed.visionAnalysis.slice(0, 300)
    };
  }

  const officeExts = ['.docx', '.pptx', '.xlsx'];
  if (officeExts.includes(ext)) {
    const parsed = parseOfficeDoc(buffer, ext);
    return {
      name,
      ext,
      type: 'office',
      summary: `[Office Document: ${name}]`,
      content: parsed.text,
      preview: parsed.text.slice(0, 300)
    };
  }

  // Text, code, config files
  const textContent = buffer.toString('utf8');
  return {
    name,
    ext,
    type: 'text',
    summary: `[File: ${name}]`,
    content: textContent,
    preview: textContent.slice(0, 300)
  };
}

/**
 * 5. File Modification & Workspace Storage
 */
function saveWorkspaceFile(filename, content, subfolder = '') {
  let targetDir = WORKSPACE_DIR;
  if (subfolder) {
    targetDir = path.join(WORKSPACE_DIR, subfolder.replace(/[^\w-]/g, '_'));
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const safeName = path.basename(filename);
  const targetPath = path.join(targetDir, safeName);

  if (Buffer.isBuffer(content)) {
    fs.writeFileSync(targetPath, content);
  } else if (typeof content === 'string' && content.startsWith('data:')) {
    const base64Index = content.indexOf(';base64,');
    if (base64Index !== -1) {
      fs.writeFileSync(targetPath, Buffer.from(content.slice(base64Index + 8), 'base64'));
    } else {
      fs.writeFileSync(targetPath, content, 'utf8');
    }
  } else {
    fs.writeFileSync(targetPath, content, 'utf8');
  }

  return {
    success: true,
    filename: safeName,
    path: targetPath,
    bytes: fs.statSync(targetPath).size,
    timestamp: new Date().toISOString()
  };
}

function listWorkspaceFiles() {
  if (!fs.existsSync(WORKSPACE_DIR)) return [];
  const results = [];

  function scan(dir, relPath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = relPath ? `${relPath}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        scan(full, rel);
      } else {
        const stat = fs.statSync(full);
        results.push({
          name: ent.name,
          relativePath: rel,
          sizeBytes: stat.size,
          modified: stat.mtime.toISOString()
        });
      }
    }
  }

  scan(WORKSPACE_DIR);
  return results;
}

module.exports = {
  WORKSPACE_DIR,
  parsePdf,
  parseImage,
  parseOfficeDoc,
  processUploadedFile,
  saveWorkspaceFile,
  listWorkspaceFiles
};
