import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/*
  Fixes & improvements:
  - Do not reference $ in the catch path (avoid ReferenceError).
  - Use a retry loop with exponential backoff for transient network/timeout failures.
  - Increased timeout default to 30s and allow up to 3 attempts.
  - Only save debug snapshot if we actually received a body.
  - Clearer error messages including err.name and err.message.
  - Continue to try other URLs if one fails.
*/

const urls = [
  'https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2899955301',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchWithTimeout(url, timeoutMs = 30000, signal = null) {
  const controller = new AbortController();
  const combinedSignal = signal ?? controller.signal;
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: combinedSignal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithRetries(url, attempts = 3, timeoutMs = 30000) {
  let attempt = 0;
  let lastError = null;

  while (attempt < attempts) {
    attempt += 1;
    try {
      console.log(`Attempt ${attempt} fetching ${url} (timeout ${timeoutMs}ms)`);
      const res = await fetchWithTimeout(url, timeoutMs);
      // Treat non-2xx/3xx as a valid response but log it; caller can decide what to do.
      return res;
    } catch (err) {
      lastError = err;
      const name = err && err.name ? err.name : 'Error';
      const msg = err && err.message ? err.message : String(err);
      console.warn(`Fetch attempt ${attempt} failed for ${url}: ${name} - ${msg}`);
      // exponential backoff before next attempt (base 500ms)
      if (attempt < attempts) {
        const backoff = 500 * Math.pow(2, attempt - 1);
        console.log(`Waiting ${backoff}ms before retrying...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  // All attempts failed
  const err = new Error(`All ${attempts} fetch attempts failed for ${url}: ${lastError?.message ?? String(lastError)}`);
  err.cause = lastError;
  throw err;
}

async function fetchAndParse(url, idx) {
  try {
    console.log(`Fetching: ${url}`);
    const res = await fetchWithRetries(url, 3, 30000);
    console.log(`Status for ${url}: ${res.status}`);
    const body = await res.text();

    if (body && body.length > 0) {
      try {
        const debugPath = path.join(__dirname, `debug-page-${idx}.html`);
        await fs.writeFile(debugPath, body, 'utf8');
        console.log(`Saved debug snapshot to ${debugPath}`);
      } catch (err) {
        console.warn('Failed to write debug snapshot:', err && err.message ? err.message : err);
      }
    } else {
      console.warn(`Received empty body from ${url}`);
    }

    const $ = cheerio.load(body || '');
    return { $, status: res.status, html: body };
  } catch (err) {
    console.error(`Fetch/parse failed for ${url}:`, err && err.message ? `${err.name}: ${err.message}` : err);
    // Return a well-formed object with $ null so callers don't ReferenceError
    return { $: null, status: null, html: null, error: err };
  }
}

function normalizeMapName(name) {
  if (!name) return '';
  let mapName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  mapName = mapName.replace(/-v\d+(\.\d+)*$/, '');
  mapName = mapName.replace(/^\|dlc\|-/i, '');
  mapName = mapName.replace(/-map$/i, '');
  mapName = mapName.replace(/'/g, '');
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
      if (error) {
        console.warn(`Skipping URL due to fetch/parse error: ${url}`);
        continue;
      }
      if (!status || status >= 400) {
        console.warn(`Skipping URL due to HTTP status ${status}: ${url}`);
        continue;
      }
      if (!$) {
        console.warn(`No parsed DOM for ${url}, skipping.`);
        continue;
      }

      const detailBoxes = $('.subSection.detailBox');
      console.log(`Found ${detailBoxes.length} detail boxes for ${url}.`);

      if (!detailBoxes || detailBoxes.length === 0) {
        console.warn(`No detail boxes found at ${url} — check debug-page-${i}.html.`);
        continue;
      }

      detailBoxes.each((_, box) => {
        try {
          const $box = cheerio.load(box);
          const mapNameDiv = $box('.subSectionTitle').first();
          let mapName = mapNameDiv.text();
          mapName = normalizeMapName(mapName);

          if (!mapName) {
            console.warn('Skipping a detailBox because mapName normalized to empty string.');
            return;
          }

          const links = $box('a.modalContentLink');
          const mapLinks = [];
          links.each((_, link) => {
            const href = $box(link).attr('href') ?? '';
            const trimmed = href.trim();
            if (trimmed) mapLinks.push(trimmed);
          });

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
            maps[mapName] = {
              pilgrim: uniqueLinks[0] || '',
              interloper: uniqueLinks[1] || uniqueLinks[0] || '',
            };
          }

          anyUrlSucceeded = true;
        } catch (err) {
          console.warn('Error processing a detailBox, continuing with others:', err && err.message ? err.message : err);
        }
      });
    } catch (err) {
      console.error(`Unexpected error processing URL ${url}:`, err && err.message ? err.message : err);
    }
  }

  try {
    if (!anyUrlSucceeded || Object.keys(maps).length === 0) {
      console.error('No maps were found from any source URLs. Check debug-page-*.html snapshots for details.');
      process.exit(1);
    }

    const outputFilePath = path.join(__dirname, 'maps.json');
    await fs.writeFile(outputFilePath, JSON.stringify(maps, null, 2), 'utf8');
    console.log(`maps.json has been updated at ${outputFilePath} (entries: ${Object.keys(maps).length})`);
  } catch (err) {
    console.error('Failed to write maps.json:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

updateMaps();
