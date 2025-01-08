import fetch from "node-fetch";
import * as cheerio from 'cheerio';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const urls = [
  'https://steamcommunity.com/sharedfiles/filedetails/?id=3255435617',
  'https://steamcommunity.com/sharedfiles/filedetails/?id=2899955301'
];

// Get the current file name and directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchAndParse(url) {
  console.log(`Fetching URL: ${url}`);
  const response = await fetch(url);
  const body = await response.text();
  return cheerio.load(body);
}

async function updateMaps() {
  try {
    const maps = {};

    for (const url of urls) {
      const $ = await fetchAndParse(url);

      const detailBoxes = $('.subSection.detailBox');
      console.log(`Found ${detailBoxes.length} detail boxes.`);

      detailBoxes.each((i, box) => {
        const mapNameDiv = $(box).find('.subSectionTitle');
        let mapName = mapNameDiv.text().trim().toLowerCase().replace(/\s+/g, '-');

        // Trim the "-vX.XX" suffix
        mapName = mapName.replace(/-v\d+\.\d+$/, '');

        // Remove the "|dlc|-" prefix
        mapName = mapName.replace(/^\|dlc\|-/i, '');

        // Remove the "-map" suffix
        mapName = mapName.replace(/-map$/, '');

        // Remove the apostrophe (') character
        mapName = mapName.replace(/'/g, '');

        console.log(`Processing map: ${mapName}`);

        if (mapName) {
          const links = $(box).find('a.modalContentLink');
          const mapLinks = [];

          links.each((i, link) => {
            const url = $(link).attr('href');
            mapLinks.push(url);
          });

          if (mapLinks.length === 1) {
            maps[mapName] = {
              pilgrim: mapLinks[0],
              interloper: mapLinks[0]
            };
          } else if (mapLinks.length >= 2) {
            maps[mapName] = {
              pilgrim: mapLinks[0],
              interloper: mapLinks[1]
            };
          }
        }
      });
    }

    fs.writeFileSync(path.join(__dirname, 'maps.json'), JSON.stringify(maps, null, 2));
    console.log('maps.json has been updated');
  } catch (error) {
    console.error('Error fetching or processing data:', error);
    process.exit(1); // Ensure the script exits with code 1 on error
  }
}

updateMaps();