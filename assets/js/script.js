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

function loadMap(mapId) {
  document.querySelectorAll('.highlight-overlay').forEach((el) => el.remove());
  showMap(mapId);
  document.getElementById('start-map-image').style.display = 'none';
  document.querySelector('#images-wrapper').style.display = 'block';
}

function showStartMap() {
  document.getElementById('start-map-image').style.display = 'block';
  document.querySelectorAll('.image-container').forEach((image) => {
    image.classList.remove('active');
  });
  const img = document.querySelector('#map-image img');
  if (img) img.src = '';
  resetTransform();
}

document.getElementById('homeButton').addEventListener('click', showStartMap);

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

// ─── Init ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  scaleMapAreas();
  updateMaps();
});

window.addEventListener('resize', scaleMapAreas);
