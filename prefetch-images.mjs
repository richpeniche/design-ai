// prefetch-images.mjs
// Scrapes og:image tags directly from each tool's website — no API needed.
// Run once locally: node prefetch-images.mjs
// Safe to re-run: only fetches URLs not already in the map.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, 'index.html');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const DELAY_MS   = 1200;

function extractUrls(html) {
  const start = html.indexOf('const TOOLS = [');
  const end   = html.indexOf('\nfunction getMaturityClass');
  if (start === -1 || end === -1) throw new Error('Could not locate TOOLS array in HTML');
  const block = html.slice(start, end);
  const urls  = [...block.matchAll(/website:\s*"([^"]+)"/g)].map(m => m[1]);
  return [...new Set(urls)];
}

function extractExistingMap(html) {
  const match = html.match(/const OG_IMAGE_MAP = (\{[\s\S]*?\});\s*<\/script>/);
  if (!match) return {};
  try { return JSON.parse(match[1]); } catch { return {}; }
}

async function fetchOgImage(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const reader = res.body.getReader();
    let html = '';
    while (html.length < 20000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      if (html.includes('</head>')) break;
    }
    reader.cancel();

    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1];

    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch) return twMatch[1];

    return null;
  } catch {
    return null;
  }
}

function patchHtml(html, imageMap) {
  const mapScript = `<script id="og-image-map">
const OG_IMAGE_MAP = ${JSON.stringify(imageMap, null, 2)};
</script>`;

  const fetchFn = `function fetchOgImage(container) {
  const url = container.getAttribute('data-url');
  if (!url) return;
  const imageUrl = OG_IMAGE_MAP[url];
  const placeholder = container.querySelector('.card-image-placeholder');
  if (!placeholder) return;
  if (!imageUrl) {
    const toolName = container.closest('.card').querySelector('.card-name').textContent.trim();
    const initial = toolName.charAt(0).toUpperCase();
    const fallback = document.createElement('div');
    fallback.className = 'card-image-fallback';
    fallback.textContent = initial;
    placeholder.replaceWith(fallback);
    return;
  }
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = '';
  img.loading = 'lazy';
  img.onload = () => { img.style.opacity = '1'; };
  img.onerror = () => {
    const toolName = container.closest('.card').querySelector('.card-name').textContent.trim();
    const initial = toolName.charAt(0).toUpperCase();
    const fallback = document.createElement('div');
    fallback.className = 'card-image-fallback';
    fallback.textContent = initial;
    img.replaceWith(fallback);
  };
  placeholder.replaceWith(img);
}`;

  const modalFetch = `  if (tool.website) {
    const src = OG_IMAGE_MAP[tool.website];
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'eager';
      img.onload = () => { img.style.opacity = '1'; };
      imgContainer.innerHTML = '';
      imgContainer.appendChild(img);
      const overlay = document.createElement('div');
      overlay.id = 'modal-image-overlay';
      imgContainer.appendChild(overlay);
    }
  }`;

  let patched = html;

  if (patched.includes('<script id="og-image-map">')) {
    patched = patched.replace(/<script id="og-image-map">[\s\S]*?<\/script>/, mapScript);
  } else {
    patched = patched.replace('<script>\nconst TOOLS', `${mapScript}\n<script>\nconst TOOLS`);
  }

  patched = patched.replace(/function fetchOgImage\(container\) \{[\s\S]*?^}/m, fetchFn);

  if (patched.includes('api.microlink.io')) {
    const oldModalFetch = `  if (tool.website) {
    const apiUrl = \`https://api.microlink.io/?url=\${encodeURIComponent(tool.website)}\`;
    fetch(apiUrl)
      .then(r => r.json())
      .then(data => {
        const src = data && data.data && data.data.image && data.data.image.url;
        if (src) {
          const img = document.createElement('img');
          img.src = src;
          img.alt = '';
          img.loading = 'eager';
          img.onload = () => { img.style.opacity = '1'; };
          imgContainer.innerHTML = '';
          imgContainer.appendChild(img);
          const overlay = document.createElement('div');
          overlay.id = 'modal-image-overlay';
          imgContainer.appendChild(overlay);
        }
      })
      .catch(() => {});
  }`;
    patched = patched.replace(oldModalFetch, modalFetch);
  }

  return patched;
}

async function main() {
  const html        = readFileSync(FILE, 'utf8');
  const urls        = extractUrls(html);
  const existingMap = extractExistingMap(html);
  const newUrls     = urls.filter(u => !existingMap[u]);

  console.log(`Tools: ${urls.length} total, ${newUrls.length} new\n`);

  if (newUrls.length === 0) {
    console.log('Nothing new to fetch. index.html unchanged.');
    return;
  }

  const imageMap = { ...existingMap };
  let fetched = 0;

  for (let i = 0; i < newUrls.length; i++) {
    const url = newUrls[i];
    process.stdout.write(`  [${i + 1}/${newUrls.length}] ${url.slice(0, 58).padEnd(58)} → `);
    const img = await fetchOgImage(url);
    if (img) {
      imageMap[url] = img;
      fetched++;
      console.log(`✓`);
    } else {
      imageMap[url] = null;
      console.log(`✗`);
    }
    if (i < newUrls.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nResolved ${fetched} / ${newUrls.length} images.`);
  const patched = patchHtml(html, imageMap);
  writeFileSync(FILE, patched, 'utf8');
  console.log(`✓ index.html updated (${fetched} new images added)`);
}

main().catch(err => { console.error(err); process.exit(1); });
