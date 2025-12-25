import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
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
  let mapName = name.trim().toLowerCase().replace(/\s+/g, '-');
  mapName = mapName.replace(/-v\d+(\.\d+)*$/, '');
  mapName = mapName.replace(/^\|dlc\|-/i, '');
  mapName = mapName.replace(/-map$/i, '');
  mapName = mapName.replace(/'/g, '');
  mapName = mapName.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return mapName;
}

async function fetchAndLoad(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }
  const body = await res.text();
  return cheerio.load(body);
}

async function updateMaps() {
  try {
    const maps = {};

    for (const url of urls) {
      console.log('Fetching', url);
      let $;
      try {
        $ = await fetchAndLoad(url);
      } catch (err) {
        console.error(`Failed to fetch ${url}:`, err.message || err);
        throw new Error(`Failed to fetch ${url}:`, err.message || err);
      }

      const detailBoxes = $('.subSection.detailBox');
      console.log(`Found ${detailBoxes.length} detail boxes on ${url}`);

      if (!detailBoxes || detailBoxes.length === 0) {
        console.error(`No detail boxes found on ${url}, aborting.`);
        throw new Error(`No detail boxes found on ${url}`);
      }

      detailBoxes.each((_, box) => {
        const $box = cheerio.load(box);
        const titleEl = $box('.subSectionTitle').first();
        const rawName = titleEl.text() || '';
        const mapName = normalizeMapName(rawName);

        if (!mapName) {
          console.warn('Skipping detailBox with empty/invalid name');
          return;
        }

        const links = $box('a.modalContentLink');
        const mapLinks = [];
        links.each((_, a) => {
          const href = $box(a).attr('href') || '';
          const trimmed = href.trim();
          if (trimmed) mapLinks.push(trimmed);
        });

        // keep first two meaningful links
        const unique = Array.from(new Set(mapLinks));
        if (unique.length === 0) {
          console.warn(`No links found for "${mapName}", skipping.`);
          return;
        }

        if (unique.length === 1) {
          maps[mapName] = { pilgrim: unique[0], interloper: unique[0] };
        } else {
          maps[mapName] = { pilgrim: unique[0], interloper: unique[1] };
        }

        console.log(`Added map "${mapName}" with ${unique.length} link(s)`);
      });
    }

    if (Object.keys(maps).length === 0) {
      throw new Error('No maps were found from any source URLs.');
    }

    const outputFilePath = path.join(__dirname, 'maps.json');
    await fs.writeFile(outputFilePath, JSON.stringify(maps, null, 2), 'utf8');
    console.log(`maps.json updated: ${outputFilePath} (entries: ${Object.keys(maps).length})`);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

updateMaps();
