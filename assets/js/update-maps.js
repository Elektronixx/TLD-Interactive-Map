import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const urls = [
  'https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2899955301',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeMapName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-v\d+(\.\d+)*$/, '')
    .replace(/^\|dlc\|-/i, '')
    .replace(/-map$/i, '')
    .replace(/'/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function extractDetailBoxes(html) {
  const boxes = [];
  const searchStr = 'class="subSection detailBox"';
  let pos = 0;

  while (true) {
    const start = html.indexOf(searchStr, pos);
    if (start === -1) break;

    // Find the opening <div tag start
    const divStart = html.lastIndexOf('<div', start);

    // Walk forward counting open/close divs to find matching closing tag
    let depth = 0;
    let i = divStart;
    while (i < html.length) {
      if (html[i] === '<') {
        if (html.slice(i, i + 4) === '<div') {
          depth++;
        } else if (html.slice(i, i + 6) === '</div>') {
          depth--;
          if (depth === 0) {
            boxes.push(html.slice(divStart, i + 6));
            pos = i + 6;
            break;
          }
        }
      }
      i++;
    }
    if (depth !== 0) break; // malformed HTML guard
  }

  return boxes;
}

function extractTitle(boxHtml) {
  const match = boxHtml.match(/<div[^>]*class="[^"]*subSectionTitle[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  if (!match) return '';
  // Strip any inner HTML tags
  return match[1].replace(/<[^>]+>/g, '').trim();
}

function extractLinks(boxHtml) {
  const links = [];
  // Match any <a> tag that contains modalContentLink anywhere in its attributes
  const tagRegex = /<a\s([^>]*)>/g;
  let match;
  while ((match = tagRegex.exec(boxHtml)) !== null) {
    const attrs = match[1];
    if (!attrs.includes('modalContentLink')) continue;
    const hrefMatch = attrs.match(/href="([^"]+)"/);
    if (hrefMatch) links.push(hrefMatch[1].trim());
  }
  return [...new Set(links)];
}

async function updateMaps() {
  try {
    const maps = {};

    for (const url of urls) {
      console.log('Fetching', url);
      const html = await fetchPage(url);
      const boxes = extractDetailBoxes(html);
      console.log(`Found ${boxes.length} detail boxes on ${url}`);

      if (boxes.length === 0) throw new Error(`No detail boxes found on ${url}`);

      for (const box of boxes) {
        const rawName = extractTitle(box);
        const mapName = normalizeMapName(rawName);

        if (!mapName) {
          console.warn('Skipping box with empty name');
          continue;
        }

        const links = extractLinks(box);
        if (links.length === 0) {
          console.warn(`No links found for "${mapName}", skipping.`);
          continue;
        }

        maps[mapName] = {
          pilgrim: links[0],
          interloper: links[1] ?? links[0],
        };
        console.log(`Added "${mapName}" with ${links.length} link(s)`);
      }
    }

    if (Object.keys(maps).length === 0) throw new Error('No maps found from any source.');

    const outputPath = path.join(__dirname, 'maps.json');
    await fs.writeFile(outputPath, JSON.stringify(maps, null, 2), 'utf8');
    console.log(`maps.json written (${Object.keys(maps).length} entries)`);
  } catch (err) {
    console.error('Error:', err.message ?? err);
    process.exit(1);
  }
}

updateMaps();
