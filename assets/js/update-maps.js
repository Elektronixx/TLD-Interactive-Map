import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/*
  Improvements made:
  - Uses a browser-like User-Agent to avoid some basic bot blocking.
  - Handles non-200 responses and per-URL errors without aborting the whole run.
  - Saves a debug HTML snapshot per source URL when things go wrong (debug-<idx>.html).
  - Adds a fetch timeout to avoid hanging (uses global AbortController).
  - Filters out empty/malformed hrefs and normalizes map names more robustly.
  - Writes maps.json only if at least one map was found; exits non-zero otherwise.
  - Uses fs/promises and await consistently.
*/

const urls = [
  'https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2899955301',
];

// Get the current file name and directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchAndParse(url, idx) {
  try {
    console.log(`Fetching: ${url}`);
    const res = await fetchWithTimeout(url, 20000);
    console.log(`Status for ${url}: ${res.status}`);
    const body = await res.text();

    // Save debug snapshot for triage if needed
    try {
      const debugPath = path.join(__dirname, `debug-page-${idx}.html`);
      await fs.writeFile(debugPath, body, 'utf8');
      console.log(`Saved debug snapshot to ${debugPath}`);
    } catch (err) {
      console.warn('Failed to write debug snapshot:', err);
    }

    const $ = cheerio.load(body);
    return { $, status: res.status, html: body };
  } catch (err) {
    // network/timeout errors
    console.error(`Fetch failed for ${url}:`, err && err.name ? err.name : err);
    return { $, status: null, html: null, error: err };
  }
}

function normalizeMapName(name) {
  if (!name) return '';
  let mapName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  // Trim common version suffixes like -v1.23 or -v10.2.3
  mapName = mapName.replace(/-v\d+(\.\d+)*$/, '');

  // Remove common prefixes/suffixes
  mapName = mapName.replace(/^\|dlc\|-/i, '');
  mapName = mapName.replace(/-map$/i, '');
  mapName = mapName.replace(/'/g, '');

  // Remove any duplicate dashes
  mapName = mapName.replace(/-+/g, '-').replace(/^-|-$/g, '');

  return mapName;
}

async function updateMaps() {
  const maps = {};
  let anyUrlSucceeded = false;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const { $, status, html, error } = await fetchAndParse(url, i);
      if (error || status !== 200 || !$) {
        console.warn(`Skipping URL due to fetch/parse issues: ${url}`);
        continue;
      }

      const detailBoxes = $('.subSection.detailBox');
      console.log(`Found ${detailBoxes.length} detail boxes for ${url}.`);

      if (!detailBoxes || detailBoxes.length === 0) {
        console.warn(`No detail boxes found at ${url} — saved debug snapshot (debug-page-${i}.html).`);
        continue;
      }

      detailBoxes.each((_, box) => {
        try {
          const mapNameDiv = cheerio.load(box)('.subSectionTitle').first();
          let mapName = mapNameDiv.text();
          mapName = normalizeMapName(mapName);

          if (!mapName) {
            console.warn('Skipping a detailBox because mapName normalized to empty string.');
            return;
          }

          const links = cheerio.load(box)('a.modalContentLink');
          const mapLinks = [];
          links.each((_, link) => {
            const href = cheerio.load(link).attr('href') ?? '';
            const trimmed = href.trim();
            if (trimmed) mapLinks.push(trimmed);
          });

          // Remove duplicates and keep original order
          const uniqueLinks = Array.from(new Set(mapLinks));

          console.log(`Map "${mapName}" links found:`, uniqueLinks);

          if (uniqueLinks.length === 0) {
            console.warn(`No links found for map "${mapName}", skipping.`);
            return;
          }

          if (uniqueLinks.length === 1) {
            maps[mapName] = {
              pilgrim: uniqueLinks[0],
              interloper: uniqueLinks[0],
            };
          } else {
            // at least 2
            maps[mapName] = {
              pilgrim: uniqueLinks[0] || '',
              interloper: uniqueLinks[1] || uniqueLinks[0] || '',
            };
          }

          anyUrlSucceeded = true;
        } catch (err) {
          console.warn('Error processing a detailBox, continuing with others:', err);
        }
      });
    } catch (err) {
      console.error(`Unexpected error processing URL ${url}:`, err);
      // continue to next URL
    }
  }

  try {
    if (!anyUrlSucceeded || Object.keys(maps).length === 0) {
      console.error('No maps were found from any source URLs. Check debug-page-*.html snapshots for details.');
      // keep debug snapshots around for inspection; exit non-zero so CI fails fast
      process.exit(1);
    }

    // Save maps.json in the assets/js directory
    const outputFilePath = path.join(__dirname, 'maps.json');
    await fs.writeFile(outputFilePath, JSON.stringify(maps, null, 2), 'utf8');
    console.log(`maps.json has been updated at ${outputFilePath} (entries: ${Object.keys(maps).length})`);
  } catch (err) {
    console.error('Failed to write maps.json:', err);
    process.exit(1);
  }
}

updateMaps();
