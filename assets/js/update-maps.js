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
  // Extract each subSection detailBox block
  const boxes = [];
  const boxRegex = /<div[^>]*class="[^"]*subSection detailBox[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  let match;
  while ((match = boxRegex.exec(html)) !== null) {
    boxes.push(match[0]);
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
  const linkRegex = /<a[^>]*class="[^"]*modalContentLink[^"]*"[^>]*href="([^"]+)"/g;
  let match;
  while ((match = linkRegex.exec(boxHtml)) !== null) {
    const href = match[1].trim();
    if (href) links.push(href);
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
