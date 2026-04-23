let currentCategory = 'pilgrim';
let maps = {};

// Single source of truth — pan + zoom both applied as transform on the img
let zoomLevel = 1;
let panX = 0, panY = 0;
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let dragStartPanX = 0, dragStartPanY = 0;

function applyTransform() {
  const img = document.querySelector('#map-image img');
  if (img) img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
}

function resetTransform() {
  zoomLevel = 1; panX = 0; panY = 0;
  applyTransform();
}

// ─── Maps JSON ───────────────────────────────────────────────────────────────

async function updateMaps() {
  try {
    const response = await fetch('assets/js/maps.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    maps = await response.json();
    console.log('Maps data loaded.');
  } catch (error) {
    console.error('Error fetching maps.json:', error);
    const img = document.getElementById('start-map-image');
    if (img) img.alt = 'Failed to load map data. Please refresh the page.';
  }
}

// ─── Passage Coordinates ──────────────────────────────────────────────────────

let currentMapid = null;

const mapTransitions = {
  "mystery-lake": [
    { x: 1933, y: 4230, w: 150, h: 150, target: "forlorn-muskeg" },
    { x: 667, y: 4160, w: 150, h: 150, target: "mountain-town" },
    { x: 3823, y: 1202, w: 150, h: 150, target: "winding-river-&-carter-hydro-dam" },
    { x: 3980, y: 1427, w: 150, h: 150, target: "ravine" },
  ],
  "forlorn-muskeg": [
    { x: 2974, y: 1646, w: 150, h: 150, target: "mystery-lake" },
    { x: 176, y: 2037, w: 150, h: 150, target: "broken-railroad" },
    { x: 701, y: 923, w: 150, h: 150, target: "mountain-town" },
    { x: 2399, y: 3329, w: 150, h: 150, target: "bleak-inlet" },
  ],
  "ravine" : [
    { x: 104, y: 916, w: 150, h: 150, target: "mystery-lake" },
    { x: 1210, y: 1120, w: 150, h: 150, target: "bleak-inlet" },
    { x: 2088, y: 894, w: 150, h: 150, target: "coastal-highway" },
  ],
  "winding-river-&-carter-hydro-dam" : [
    { x: 1806, y: 2987, w: 150, h: 150, target: "mystery-lake" },
    { x: 2699, y: 1655, w: 150, h: 150, target: "mystery-lake" },
    { x: 3194, y: 593, w: 150, h: 150, target: "pleasant-valley" },
  ],
  "pleasant-valley" : [
    { x: 1159, y: 3798, w: 150, h: 150, target: "winding-river-&-carter-hydro-dam" },
    { x: 4307, y: 3783, w: 150, h: 150, target: "coastal-highway" },
    { x: 3928, y: 51, w: 150, h: 150, target: "timberwolf-mountain" },
  ],
  "coastal-highway" : [
    { x: 321, y: 271, w: 150, h: 150, target: "ravine" },
    { x: 2042, y: 58, w: 150, h: 150, target: "pleasant-valley" },
    { x: 3175, y: 2846, w: 150, h: 150, target: "crumbling-highway" },
  ],
  "crumbling-highway" : [
    { x: 125, y: 895, w: 150, h: 150, target: "coastal-highway" },
    { x: 1617, y: 722, w: 150, h: 150, target: "desolation-point" },
  ],
  "desolation-point" : [
    { x: 133, y: 976, w: 150, h: 150, target: "crumbling-highway" },
  ],
  "bleak-inlet" : [
    { x: 2336, y: 658, w: 150, h: 150, target: "ravine" },
    { x: 1601, y: 793, w: 150, h: 150, target: "forlorn-muskeg" },
  ],
  "keepers-pass" : [
    { x: 995, y: 1626, w: 150, h: 150, target: "pleasant-valley" },
    { x: 1562, y: 364, w: 150, h: 150, target: "blackrock" },
  ],
  "blackrock" : [
    { x: 2935, y: 2173, w: 150, h: 150, target: "timberwolf-mountain" },
  ],
  "timberwolf-mountain" : [
    { x: 272, y: 2539, w: 150, h: 150, target: "pleasant-valley" },
    { x: 2736, y: 1891, w: 150, h: 150, target: "ash-canyon" },
    { x: 2561, y: 645, w: 150, h: 150, target: "ash-canyon" },
    { x: 260, y: 843, w: 150, h: 150, target: "blackrock" },
  ],
  "ash-canyon" : [
    { x: 2801, y: 2971, w: 150, h: 150, target: "timberwolf-mountain" },
    { x: 1210, y: 2942, w: 150, h: 150, target: "timberwolf-mountain" },
  ],
  "mountain-town" : [
    { x: 313, y: 3319, w: 150, h: 150, target: "forlorn-muskeg" },
    { x: 2410, y: 2272, w: 150, h: 150, target: "mystery-lake" },
    { x: 1636, y: 202, w: 150, h: 150, target: "hushed-river-valley" },
  ],
  "hushed-river-valley" : [
    { x: 695, y: 2557, w: 150, h: 150, target: "mountain-town" },
  ]
}

// ─── Difficulty ───────────────────────────────────────────────────────────────

function setCategory(difficulty) {
  currentCategory = difficulty;
}

document.querySelectorAll('.difficulty-buttons button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.difficulty-buttons button').forEach((btn) => {
      btn.classList.remove('active');
    });
    button.classList.add('active');
    setCategory(button.id.toLowerCase());
  });
});

// ─── Map scaling (FIX: stores original coords, never mutates them) ────────────

function scaleMapAreas() {
  const img = document.getElementById('start-map-image');
  if (!img) return;

  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;
  if (!originalWidth || !originalHeight) return;

  const scaleFactorX = img.clientWidth / originalWidth;
  const scaleFactorY = img.clientHeight / originalHeight;

  document.querySelectorAll('area').forEach((area) => {
    // Store original coords once — never overwrite
    if (!area.dataset.originalCoords) {
      area.dataset.originalCoords = area.getAttribute('coords');
    }
    const original = area.dataset.originalCoords.split(',').map(Number);
    const scaled = original.map((coord, index) =>
      Math.round(index % 2 === 0 ? coord * scaleFactorX : coord * scaleFactorY)
    );
    area.setAttribute('coords', scaled.join(','));
  });
}

// ─── Show/Load Map ────────────────────────────────────────────────────────────

function showMap(mapId) {
  document.querySelectorAll('.image-container').forEach((image) => {
    image.classList.remove('active');
    image.style.left = '0px';
    image.style.top = '0px';
  });

  const mapImageUrl = maps[mapId]?.[currentCategory];
  if (mapImageUrl) {
    const img = document.querySelector('#map-image img');
    img.src = mapImageUrl;
    resetTransform();
    document.querySelector('#map-image').classList.add('active');
  } else {
    console.error('Map URL not found for', mapId, currentCategory);
  }
}

function loadMap(mapId, updateHistory = true) {
  currentMapId = mapId; 
  document.querySelectorAll('.highlight-overlay').forEach((el) => el.remove());
  showMap(mapId);
  document.getElementById('start-map-image').style.display = 'none';
  document.querySelector('#images-wrapper').style.display = 'block';

  // Adds the map to the browser history
  if (updateHistory) {
    window.history.pushState({ mapId: mapId }, '', `#${mapId}`);
  }
}

function showStartMap(updateHistory = true) {
  currentMapId = null; 
  document.getElementById('start-map-image').style.display = 'block';
  document.querySelectorAll('.image-container').forEach((image) => {
    image.classList.remove('active');
  });
  const img = document.querySelector('#map-image img');
  if (img) img.src = '';
  resetTransform();

  // Clears the hash from the URL and adds to history
  if (updateHistory) {
    window.history.pushState({ mapId: 'home' }, '', window.location.pathname + window.location.search);
  }
}

// ... manter o eventListener do botão home ...
document.getElementById('homeButton').addEventListener('click', () => showStartMap());

// ─── Drag (mouse) ─────────────────────────────────────────────────────────────

document.querySelectorAll('.image-container').forEach((map) => {
  map.addEventListener('mousedown', (e) => {
    if (!map.classList.contains('active')) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
    map.classList.add('dragging');
    e.preventDefault();
  });

  // ─── Zoom (mouse wheel) ───────────────────────────────────────────────────

  map.addEventListener('wheel', (e) => {
    if (!map.classList.contains('active')) return;
    e.preventDefault();
    zoomLevel += e.deltaY < 0 ? 0.1 : -0.1;
    zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 5);
    applyTransform();
  }, { passive: false });
});

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  panX = dragStartPanX + (e.clientX - dragStartX);
  panY = dragStartPanY + (e.clientY - dragStartY);
  applyTransform();
});

document.addEventListener('mouseup', () => {
  dragging = false;
  document.querySelectorAll('.image-container').forEach((m) => m.classList.remove('dragging'));
});

// ─── Touch support (pinch-zoom + drag) ───────────────────────────────────────

let touchStartDist = null;
let touchStartZoom = 1;
let touchStartX = 0, touchStartY = 0;
let touchStartPanX = 0, touchStartPanY = 0;

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

document.querySelectorAll('.image-container').forEach((map) => {
  map.addEventListener('touchstart', (e) => {
    if (!map.classList.contains('active')) return;
    if (e.touches.length === 2) {
      touchStartDist = getTouchDistance(e.touches);
      touchStartZoom = zoomLevel;
    } else if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartPanX = panX;
      touchStartPanY = panY;
    }
    e.preventDefault();
  }, { passive: false });

  map.addEventListener('touchmove', (e) => {
    if (!map.classList.contains('active')) return;
    if (e.touches.length === 2 && touchStartDist !== null) {
      const currentDist = getTouchDistance(e.touches);
      zoomLevel = Math.min(Math.max(touchStartZoom * (currentDist / touchStartDist), 0.5), 5);
    } else if (e.touches.length === 1) {
      panX = touchStartPanX + (e.touches[0].clientX - touchStartX);
      panY = touchStartPanY + (e.touches[0].clientY - touchStartY);
    }
    applyTransform();
    e.preventDefault();
  }, { passive: false });

  map.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) touchStartDist = null;
  });
});

// ─── Settings popup (cog) ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const cogIconContainer = document.getElementById('cog-icon');
  const cogIcon = cogIconContainer.querySelector('i');
  const settingsPopup = document.getElementById('settings-popup');

  const togglePopup = () => {
    const isVisible = settingsPopup.style.display === 'block';
    settingsPopup.style.display = isVisible ? 'none' : 'block';
    cogIcon.classList.toggle('rotate', !isVisible);
  };

  cogIconContainer.addEventListener('click', togglePopup);
  cogIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup();
  });

  window.addEventListener('click', (e) => {
    if (
      e.target !== settingsPopup &&
      e.target !== cogIconContainer &&
      !settingsPopup.contains(e.target)
    ) {
      settingsPopup.style.display = 'none';
      cogIcon.classList.remove('rotate');
    }
  });

  // ─── Highlight aura animation (FIX: uses scaled image rect for positioning) ──

  setTimeout(() => {
    const img = document.getElementById('start-map-image');
    const overlayContainer = document.getElementById('overlay-container');
    const imgRect = img.getBoundingClientRect();
    const containerRect = overlayContainer.getBoundingClientRect();

    document.querySelectorAll('area').forEach((el) => {
      const rawCoords = el.dataset.originalCoords || el.getAttribute('coords');
      if (!rawCoords) return;

      const coords = rawCoords.split(',').map(Number);
      const scaleX = imgRect.width  / img.naturalWidth;
      const scaleY = imgRect.height / img.naturalHeight;

      const overlay = document.createElement('div');
      overlay.classList.add('highlight-overlay', 'highlight-aura');
      overlay.style.left   = `${imgRect.left - containerRect.left + coords[0] * scaleX}px`;
      overlay.style.top    = `${imgRect.top  - containerRect.top  + coords[1] * scaleY}px`;
      overlay.style.width  = `${(coords[2] - coords[0]) * scaleX}px`;
      overlay.style.height = `${(coords[3] - coords[1]) * scaleY}px`;
      overlayContainer.appendChild(overlay);
    });

    // Remove overlays after animation
    setTimeout(() => {
      document.querySelectorAll('.highlight-overlay').forEach((el) => el.remove());
    }, 5000);
  }, 1000);
});

// ─── Init & Browser History ────────────────────────────────────────────────────

window.addEventListener('popstate', (e) => {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    // Loads the map but tells the function NOT to push to history again
    loadMap(hash, false);
  } else {
    // If there is no hash, go back to the home screen
    showStartMap(false);
  }
});

// Initialization
window.addEventListener('load', async () => { // Note the 'async' here
  scaleMapAreas();
  await updateMaps(); // Wait for the maps to load first
  
  // Check if the user entered the site with a hash link (e.g., /#mystery-lake)
  const hash = window.location.hash.replace('#', '');
  if (hash && maps[hash]) {
    loadMap(hash, false);
  }
});

window.addEventListener('resize', scaleMapAreas);

// ─── Passage Click Coordinates Logic ──────────────────────────────────────────

const mapContainer = document.querySelector('#map-image'); // Fix: Attach events to the container
let clickStartX = 0;
let clickStartY = 0;

mapContainer.addEventListener('mousedown', (e) => {
  clickStartX = e.clientX;
  clickStartY = e.clientY;
});

mapContainer.addEventListener('mouseup', (e) => {
  if (!currentMapId) return;

  const moveX = Math.abs(e.clientX - clickStartX);
  const moveY = Math.abs(e.clientY - clickStartY);
  if (moveX > 5 || moveY > 5) return; // User was panning, not clicking

  const transitions = mapTransitions[currentMapId];
  if (!transitions) return;

  const regionImage = mapContainer.querySelector('img');
  const rect = regionImage.getBoundingClientRect();
  const scaleX = rect.width / regionImage.naturalWidth;
  const scaleY = rect.height / regionImage.naturalHeight;
  const clickX = (e.clientX - rect.left) / scaleX;
  const clickY = (e.clientY - rect.top) / scaleY;

  for (const t of transitions) {
    if (
      clickX >= t.x && clickX <= t.x + t.w &&
      clickY >= t.y && clickY <= t.y + t.h
    ) {
      console.log(`Transition detected! Loading: ${t.target}`);
      loadMap(t.target);
      break;
    }
  }
});

// ─── Devoloper tools: Right-click on the red passage in the map ───────────────
mapContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // Prevents the default browser context menu
  if (!currentMapId) return;

  const regionImage = mapContainer.querySelector('img');
  const rect = regionImage.getBoundingClientRect();
  const scaleX = rect.width / regionImage.naturalWidth;
  const scaleY = rect.height / regionImage.naturalHeight;
  
  const clickX = Math.round((e.clientX - rect.left) / scaleX);
  const clickY = Math.round((e.clientY - rect.top) / scaleY);

  // Considers a 150x150 pixel "target" centered on where you clicked
  const targetObj = `{ x: ${clickX - 75}, y: ${clickY - 75}, w: 150, h: 150, target: "MAP_NAME" },`;
  
  console.log("Copy the code below and paste it into your mapTransitions:");
  console.log(targetObj);
  alert("Code generated in the Browser Console (F12)!");
});
