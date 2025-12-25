import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/*
  Strategy:
  1) For each Steam Workshop URL, extract the numeric published file id.
  2) Query the Steam API (ISteamRemoteStorage/GetPublishedFileDetails) for structured data.
     - If the API returns useful links (file_url, preview_url, or links inside the description),
       use those links to build the map entry (prefer API).
  3) If the API call fails or doesn't provide sufficient links, fall back to HTML scraping
     of the Workshop page (cheerio) — the fallback preserves the earlier scraping logic.
  4) Save debug snapshots:
     - debug-api-<id>.json for API response
     - debug-page-<idx>.html for scraped HTML when used or saved for inspection
  5) Write assets/js/maps.json if any maps were discovered; otherwise exit non-zero so CI can fail and you can inspect debug snapshots.
*/

const urls = [
  'https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2899955301',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function safeJsonWrite(filePath, obj) {
  try {
    await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8');
    console.log(`Saved JSON debug file: ${filePath}`);
  } catch (err) {
    console.warn('Failed saving JSON debug file:', err && err.message ? err.message : err);
  }
}

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
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`Attempt ${attempt} fetching ${url}`);
      const res = await fetchWithTimeout(url, timeoutMs);
      return res;
    } catch (err) {
      lastError = err;
      console.warn(`Fetch attempt ${attempt} failed for ${url}: ${err?.name ?? 'Error'} - ${err?.message ?? String(err)}`);
      if (attempt < attempts) {
        const backoff = 500 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  const err = new Error(`All ${attempts} fetch attempts failed for ${url}: ${lastError?.message ?? String(lastError)}`);
  err.cause = lastError;
  throw err;
}

/* Steam API call to get published file details */
async function getPublishedFileDetails(publishedFileId) {
  const apiUrl = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';
  const params = new URLSearchParams();
  params.append('itemcount', '1');
  params.append('publishedfileids[0]', String(publishedFileId));

  const res = await fetchWithRetries(apiUrl, 3, 20000).catch((err) => {
    throw new Error(`Steam API fetch failed: ${err.message}`);
  });

  if (!res.ok) {
    throw new Error(`Steam API returned ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  // Save API debug response
  await safeJsonWrite(path.join(__dirname, `debug-api-${publishedFileId}.json`), json);
  const details = json?.response?.publishedfiledetails?.[0] ?? null;
  return details;
}

/* Extract possible links from API details: file_url, preview_url, links inside description */
function extractLinksFromDetails(details) {
  const links = [];

  if (!details) return links;

  if (details.file_url && typeof details.file_url === 'string') links.push(details.file_url);
  if (details.preview_url && typeof details.preview_url === 'string') links.push(details.preview_url);

  if (details.description && typeof details.description === 'string') {
    // parse anchors in description HTML to find additional links
    const $ = cheerio.load(details.description);
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href') ?? '';
      const trimmed = href.trim();
      if (trimmed) links.push(trimmed);
    });
  }

  // Filter duplicates while preserving order
  return Array.from(new Set(links));
}

/* Scrape the actual workshop page and return cheerio root and saved debug snapshot */
async function fetchAndParsePage(url, idx) {
  try {
    const res = await fetchWithRetries(url, 3, 30000);
    console.log(`Status for ${url}: ${res.status}`);
    const body = await res.text();
    if (body && body.length > 0) {
      const debugPath = path.join(__dirname, `debug-page-${idx}.html`);
      try {
        await fs.writeFile(debugPath, body, 'utf8');
        console.log(`Saved debug snapshot to ${debugPath}`);
      } catch (err) {
        console.warn('Failed to write debug snapshot:', err && err.message ? err.message : err);
      }
    }
    const $ = cheerio.load(body || '');
    return { $, status: res.status, html: body };
  } catch (err) {
    console.warn(`Page fetch/parse failed for ${url}: ${err?.message ?? err}`);
    return { $, status: null, html: null, error: err };
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
    console.log('Processing source URL:', url);

    // extract publishedfileid
    let publishedFileId = null;
    try {
      const u = new URL(url);
      publishedFileId = u.searchParams.get('id') || null;
    } catch (err) {
      console.warn('Invalid URL, skipping:', url);
      continue;
    }

    // 1) Try Steam API first
    let linksFromApi = [];
    try {
      if (publishedFileId) {
        const details = await getPublishedFileDetails(publishedFileId);
        if (details) {
          linksFromApi = extractLinksFromDetails(details);
          console.log(`API links for ${publishedFileId}:`, linksFromApi);
        } else {
          console.log(`No details returned by API for ${publishedFileId}`);
        }
      }
    } catch (err) {
      console.warn(`Steam API call failed for id ${publishedFileId}:`, err && err.message ? err.message : err);
    }

    // If API provided at least one link, parse details.title to get mapName and use API links
    if (linksFromApi.length > 0) {
      try {
        // Use the API-provided title if possible to name the map
        const apiDebugPath = path.join(__dirname, `debug-api-${publishedFileId}.json`);
        let title = '';
        try {
          const apiJsonRaw = await fs.readFile(apiDebugPath, 'utf8').catch(() => null);
          if (apiJsonRaw) {
            const json = JSON.parse(apiJsonRaw);
            title = json?.response?.publishedfiledetails?.[0]?.title ?? '';
          }
        } catch {
          title = '';
        }

        if (!title) {
          // fallback: derive a name from the steam url or id
          title = `map-${publishedFileId}`;
        }
        const mapName = normalizeMapName(title);

        // Use API links (may be 1 or more). If only one, use same link for pilgrim & interloper.
        const uniqueLinks = Array.from(new Set(linksFromApi));
        if (uniqueLinks.length === 1) {
          maps[mapName] = { pilgrim: uniqueLinks[0], interloper: uniqueLinks[0] };
        } else {
          maps[mapName] = { pilgrim: uniqueLinks[0], interloper: uniqueLinks[1] || uniqueLinks[0] };
        }
        anyUrlSucceeded = true;
        console.log(`Added map "${mapName}" from API links`);
        continue; // proceed to next URL
      } catch (err) {
        console.warn('Error processing API-provided links, falling back to scraping:', err && err.message ? err.message : err);
        // fallthrough to scraping
      }
    }

    // 2) Fallback: scrape the Workshop page using cheerio
    try {
      const { $, status, html, error } = await fetchAndParsePage(url, i);
      if (error || !status || status >= 400) {
        console.warn(`Skipping URL due to fetch/parse issues or HTTP status ${status}: ${url}`);
        continue;
      }

      const detailBoxes = $('.subSection.detailBox');
      console.log(`Found ${detailBoxes.length} detail boxes for ${url}.`);

      if (!detailBoxes || detailBoxes.length === 0) {
        console.warn(`No detail boxes found at ${url} — check debug snapshot debug-page-${i}.html.`);
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
          console.log(`Map "${mapName}" links found (scrape):`, uniqueLinks);

          if (uniqueLinks.length === 0) {
            console.warn(`No links found for map "${mapName}", skipping.`);
            return;
          }

          if (uniqueLinks.length === 1) {
            maps[mapName] = { pilgrim: uniqueLinks[0], interloper: uniqueLinks[0] };
          } else {
            maps[mapName] = { pilgrim: uniqueLinks[0], interloper: uniqueLinks[1] || uniqueLinks[0] };
          }

          anyUrlSucceeded = true;
        } catch (err) {
          console.warn('Error processing a detailBox in scraping fallback, continuing:', err && err.message ? err.message : err);
        }
      });
    } catch (err) {
      console.error(`Unexpected error during scraping fallback for ${url}:`, err && err.message ? err.message : err);
      // continue to next URL
    }
  } // end for each url

  try {
    if (!anyUrlSucceeded || Object.keys(maps).length === 0) {
      console.error('No maps were found from any source URLs. Check debug-api-*.json and debug-page-*.html snapshots for details.');
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
