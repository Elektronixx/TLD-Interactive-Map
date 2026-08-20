let currentCategory = 'pilgrim';
let maps = {};

// Single source of truth — pan + zoom both applied as transform on the img
let zoomLevel = 1;
let panX = 0, panY = 0;
let dragging = false;
let dragStartX = 0, dragStartY = 0;
let dragStartPanX = 0, dragStartPanY = 0;

function applyTransform() {
  const stage = document.getElementById('map-stage');
  if (stage) stage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
}

function resetTransform() {
  zoomLevel = 1; panX = 0; panY = 0;
  applyTransform();
}

// ─── Local map annotations ───────────────────────────────────────────────────

const ANNOTATION_STORAGE_KEY = 'tld-map-annotations-v1';
const FOG_CANVAS_MAX_DIMENSION = 1400;
const FOG_REFERENCE_MAP_METERS = 2500;
const FOG_COLOR = '#05080a';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

let activeTool = 'pan';
let fogDrawing = false;
let fogPointerId = null;
let lastFogPoint = null;
let pendingRoutePoints = [];
let routePointerPoint = null;
let annotationStatusTimer = null;

function createDefaultAnnotationState() {
  return {
    version: 2,
    settings: {
      fogEnabled: false,
      brushSize: 80,
      fogBrushMode: 'reveal',
      shapeKind: 'circle',
      shapeSize: 8,
      shapeColor: '#ef5350',
      routeColor: '#ffb347',
    },
    maps: {},
  };
}

function loadAnnotationState() {
  const defaults = createDefaultAnnotationState();

  try {
    const saved = JSON.parse(localStorage.getItem(ANNOTATION_STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return defaults;

    return {
      version: 2,
      settings: {
        ...defaults.settings,
        ...(saved.settings && typeof saved.settings === 'object' ? saved.settings : {}),
      },
      maps: saved.maps && typeof saved.maps === 'object' ? saved.maps : {},
    };
  } catch (error) {
    console.warn('Unable to read locally saved annotations:', error);
    return defaults;
  }
}

let annotationState = loadAnnotationState();

function getMapAnnotations(mapId = currentMapId) {
  if (!mapId) return null;

  if (!annotationState.maps[mapId]) {
    annotationState.maps[mapId] = { fog: null, shapes: [], routes: [] };
  }

  const mapData = annotationState.maps[mapId];
  if (!Array.isArray(mapData.shapes)) {
    const legacyMarkers = Array.isArray(mapData.markers) ? mapData.markers : [];
    mapData.shapes = legacyMarkers.map((marker) => ({
      id: marker.id || createAnnotationId('shape'),
      x: marker.x,
      y: marker.y,
      shape: 'circle',
      size: 8,
      color: '#ef5350',
      label: marker.label || '',
    }));
  }
  delete mapData.markers;
  if (!Array.isArray(mapData.routes)) mapData.routes = [];
  return mapData;
}

function setAnnotationStatus(message, isError = false) {
  const status = document.getElementById('annotation-status');
  if (!status) return;

  window.clearTimeout(annotationStatusTimer);
  status.textContent = message;
  status.classList.toggle('error', isError);

  if (message !== 'Saved locally' && !isError) {
    annotationStatusTimer = window.setTimeout(() => {
      status.textContent = 'Saved locally';
    }, 1600);
  }
}

function saveAnnotationState() {
  try {
    localStorage.setItem(ANNOTATION_STORAGE_KEY, JSON.stringify(annotationState));
    setAnnotationStatus('Saved');
    return true;
  } catch (error) {
    console.error('Unable to save annotations locally:', error);
    setAnnotationStatus('Local storage is full', true);
    return false;
  }
}

function createAnnotationId(prefix) {
  if (window.crypto && window.crypto.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '');
}

const SHAPE_KINDS = ['circle', 'square', 'triangle', 'cross'];

function normalizeShapeKind(value) {
  return SHAPE_KINDS.includes(value) ? value : 'circle';
}

function normalizeShapeSize(value) {
  return Math.min(24, Math.max(6, Number(value) || 8));
}

function clientPointToMap(clientX, clientY) {
  const img = document.querySelector('#map-image img');
  if (!img || !img.naturalWidth) return null;

  const rect = img.getBoundingClientRect();
  if (
    rect.width <= 0 || rect.height <= 0 ||
    clientX < rect.left || clientX > rect.right ||
    clientY < rect.top || clientY > rect.bottom
  ) {
    return null;
  }

  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
  };
}

function setFogVisibility() {
  const fogCanvas = document.getElementById('fog-canvas');
  if (fogCanvas) {
    fogCanvas.classList.toggle('enabled', Boolean(annotationState.settings.fogEnabled));
  }
}

function normalizeFogBrushMode(value) {
  return value === 'restore' ? 'restore' : 'reveal';
}

function syncFogBrushModeControls() {
  const mode = normalizeFogBrushMode(annotationState.settings.fogBrushMode);
  annotationState.settings.fogBrushMode = mode;
  document.querySelectorAll('[data-fog-mode]').forEach((button) => {
    const isActive = button.dataset.fogMode === mode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  const map = document.getElementById('map-image');
  if (map) {
    map.classList.toggle(
      'fog-restore-active',
      activeTool === 'fog' && mode === 'restore',
    );
  }
}

function setFogBrushMode(mode) {
  annotationState.settings.fogBrushMode = normalizeFogBrushMode(mode);
  syncFogBrushModeControls();
  saveAnnotationState();
}

function fillFogCanvas() {
  const canvas = document.getElementById('fog-canvas');
  if (!canvas || !canvas.width || !canvas.height) return;

  const context = canvas.getContext('2d');
  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = FOG_COLOR;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function normalizeFogMaskOpacity(context, canvas) {
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let maximumAlpha = 0;
  for (let index = 3; index < imageData.data.length; index += 4) {
    maximumAlpha = Math.max(maximumAlpha, imageData.data[index]);
  }
  if (maximumAlpha === 0 || maximumAlpha === 255) return;

  const alphaScale = 255 / maximumAlpha;
  for (let index = 3; index < imageData.data.length; index += 4) {
    imageData.data[index] = Math.min(255, Math.round(imageData.data[index] * alphaScale));
  }
  context.putImageData(imageData, 0, 0);
}

function configureFogCanvas() {
  const img = document.querySelector('#map-image img');
  const canvas = document.getElementById('fog-canvas');
  const mapId = currentMapId;
  if (!img || !img.naturalWidth || !canvas || !mapId) return;

  const resolutionScale = Math.min(
    1,
    FOG_CANVAS_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight),
  );
  canvas.width = Math.max(1, Math.round(img.naturalWidth * resolutionScale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * resolutionScale));
  fillFogCanvas();
  setFogVisibility();

  const savedMapData = getMapAnnotations(mapId);
  const savedFog = savedMapData && savedMapData.fog;
  if (!savedFog) return;

  const savedMask = new Image();
  savedMask.onload = () => {
    if (currentMapId !== mapId) return;
    const context = canvas.getContext('2d');
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(savedMask, 0, 0, canvas.width, canvas.height);
    normalizeFogMaskOpacity(context, canvas);
  };
  savedMask.onerror = () => {
    console.warn(`Unable to restore fog data for ${mapId}.`);
    fillFogCanvas();
  };
  savedMask.src = savedFog;
}

function saveCurrentFog() {
  const canvas = document.getElementById('fog-canvas');
  const mapData = getMapAnnotations();
  if (!canvas || !mapData) return;

  try {
    mapData.fog = canvas.toDataURL('image/png');
    saveAnnotationState();
  } catch (error) {
    console.error('Unable to serialize fog data:', error);
    setAnnotationStatus('Could not save fog', true);
  }
}

function fogBrushDiameterFraction() {
  const brushSize = Number(annotationState.settings.brushSize) || 80;
  return brushSize / FOG_REFERENCE_MAP_METERS;
}

function applyFogBrushAtPoint(point, previousPoint = null) {
  const canvas = document.getElementById('fog-canvas');
  if (!canvas || !canvas.width || !point) return;

  const context = canvas.getContext('2d');
  const radius = Math.max(
    2,
    (fogBrushDiameterFraction() * Math.min(canvas.width, canvas.height)) / 2,
  );
  const end = { x: point.x * canvas.width, y: point.y * canvas.height };
  const start = previousPoint
    ? { x: previousPoint.x * canvas.width, y: previousPoint.y * canvas.height }
    : end;
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius * 0.45)));
  const brushMode = normalizeFogBrushMode(annotationState.settings.fogBrushMode);

  context.save();
  context.globalCompositeOperation = brushMode === 'restore' ? 'source-over' : 'destination-out';
  context.fillStyle = brushMode === 'restore' ? FOG_COLOR : '#000';
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function updateBrushPreview(point) {
  const preview = document.getElementById('brush-preview');
  const stage = document.getElementById('map-stage');
  if (!preview || !stage || !point) {
    if (preview) preview.style.opacity = '0';
    return;
  }

  const diameter = fogBrushDiameterFraction() * Math.min(stage.clientWidth, stage.clientHeight);
  preview.style.left = `${point.x * 100}%`;
  preview.style.top = `${point.y * 100}%`;
  preview.style.width = `${Math.max(4, diameter)}px`;
  preview.style.height = `${Math.max(4, diameter)}px`;
  preview.style.opacity = '1';
}

function resetCurrentFog() {
  const mapData = getMapAnnotations();
  if (!mapData) return;
  mapData.fog = null;
  fillFogCanvas();
  saveAnnotationState();
}

function createShapeGlyph(shapeKind) {
  const glyph = document.createElementNS(SVG_NAMESPACE, 'svg');
  glyph.setAttribute('viewBox', '0 0 24 24');
  glyph.setAttribute('aria-hidden', 'true');
  glyph.setAttribute('fill', 'none');
  glyph.setAttribute('stroke', 'currentColor');
  glyph.setAttribute('stroke-width', '4');
  glyph.setAttribute('stroke-linecap', 'round');
  glyph.setAttribute('stroke-linejoin', 'round');
  glyph.setAttribute('class', `map-shape__glyph map-shape__glyph--${shapeKind}`);

  if (shapeKind === 'circle') {
    const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '8');
    glyph.appendChild(circle);
  } else if (shapeKind === 'square') {
    const square = document.createElementNS(SVG_NAMESPACE, 'rect');
    square.setAttribute('x', '4');
    square.setAttribute('y', '4');
    square.setAttribute('width', '16');
    square.setAttribute('height', '16');
    glyph.appendChild(square);
  } else if (shapeKind === 'triangle') {
    const triangle = document.createElementNS(SVG_NAMESPACE, 'path');
    triangle.setAttribute('d', 'M12 3 L21 20 L3 20 Z');
    glyph.appendChild(triangle);
  } else {
    const descendingLine = document.createElementNS(SVG_NAMESPACE, 'path');
    descendingLine.setAttribute('d', 'M5 5 L19 19');
    const ascendingLine = document.createElementNS(SVG_NAMESPACE, 'path');
    ascendingLine.setAttribute('d', 'M19 5 L5 19');
    glyph.append(descendingLine, ascendingLine);
  }

  return glyph;
}

function renderShapes() {
  const layer = document.getElementById('shape-layer');
  const mapData = getMapAnnotations();
  if (!layer || !mapData) return;
  layer.replaceChildren();

  mapData.shapes.forEach((shapeData) => {
    const shapeKind = normalizeShapeKind(shapeData.shape);
    const shapeSize = normalizeShapeSize(shapeData.size);
    const shapeColor = isValidColor(shapeData.color) ? shapeData.color : '#ef5350';
    const shape = document.createElement('button');
    shape.type = 'button';
    shape.className = 'map-shape';
    shape.dataset.shapeId = shapeData.id;
    shape.style.left = `${shapeData.x * 100}%`;
    shape.style.top = `${shapeData.y * 100}%`;
    shape.style.setProperty('--shape-size', `${shapeSize}px`);
    shape.style.setProperty('--shape-color', shapeColor);
    shape.title = shapeData.label || `${shapeKind} annotation`;
    shape.setAttribute('aria-label', shape.title);

    shape.appendChild(createShapeGlyph(shapeKind));

    if (shapeData.label) {
      const label = document.createElement('span');
      label.className = 'map-shape__label';
      label.textContent = shapeData.label;
      shape.appendChild(label);
    }

    shape.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (activeTool === 'erase') {
        event.preventDefault();
        event.stopPropagation();
        removeShape(shapeData.id);
      } else if (activeTool === 'route') {
        event.preventDefault();
        event.stopPropagation();
        addRoutePoint({ x: shapeData.x, y: shapeData.y });
      }
    });
    layer.appendChild(shape);
  });
}

function addShape(point) {
  const mapData = getMapAnnotations();
  if (!mapData || !point) return;

  const selectedShape = document.querySelector('input[name="shape-kind"]:checked');
  const shapeKind = normalizeShapeKind(selectedShape && selectedShape.value);
  const shapeSize = normalizeShapeSize(document.getElementById('shape-size').value);
  const shapeColorInput = document.getElementById('shape-color').value;
  const shapeColor = isValidColor(shapeColorInput) ? shapeColorInput : '#ef5350';
  const labelInput = document.getElementById('shape-label');
  mapData.shapes.push({
    id: createAnnotationId('shape'),
    x: point.x,
    y: point.y,
    shape: shapeKind,
    size: shapeSize,
    color: shapeColor,
    label: labelInput.value.trim(),
  });
  annotationState.settings.shapeKind = shapeKind;
  annotationState.settings.shapeSize = shapeSize;
  annotationState.settings.shapeColor = shapeColor;
  saveAnnotationState();
  renderShapes();
}

function removeShape(shapeId) {
  const mapData = getMapAnnotations();
  if (!mapData) return;
  mapData.shapes = mapData.shapes.filter((shape) => shape.id !== shapeId);
  saveAnnotationState();
  renderShapes();
}

function routePointsAttribute(points) {
  return points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(' ');
}

function createRoutePolyline(points, color, className) {
  const polyline = document.createElementNS(SVG_NAMESPACE, 'polyline');
  polyline.setAttribute('points', routePointsAttribute(points));
  polyline.setAttribute('stroke', isValidColor(color) ? color : '#ffb347');
  polyline.setAttribute('stroke-width', '6');
  polyline.setAttribute('class', className);
  return polyline;
}

function renderRoutes() {
  const layer = document.getElementById('route-layer');
  const mapData = getMapAnnotations();
  if (!layer || !mapData) return;
  layer.replaceChildren();

  mapData.routes.forEach((route) => {
    if (!Array.isArray(route.points) || route.points.length < 2) return;
    const polyline = createRoutePolyline(route.points, route.color, 'planned-route');
    polyline.dataset.routeId = route.id;
    polyline.addEventListener('pointerdown', (event) => {
      if (activeTool !== 'erase' || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      removeRoute(route.id);
    });
    layer.appendChild(polyline);
  });

  if (pendingRoutePoints.length) {
    const previewPoints = routePointerPoint
      ? [...pendingRoutePoints, routePointerPoint]
      : pendingRoutePoints;
    if (previewPoints.length >= 2) {
      layer.appendChild(createRoutePolyline(
        previewPoints,
        annotationState.settings.routeColor,
        'route-preview',
      ));
    }

    pendingRoutePoints.forEach((point) => {
      const node = document.createElementNS(SVG_NAMESPACE, 'circle');
      node.setAttribute('cx', String(point.x * 1000));
      node.setAttribute('cy', String(point.y * 1000));
      node.setAttribute('r', '7');
      node.setAttribute('fill', annotationState.settings.routeColor);
      node.setAttribute('class', 'route-node');
      layer.appendChild(node);
    });
  }
}

function updateRouteButtons() {
  const finishButton = document.getElementById('finish-route');
  const cancelButton = document.getElementById('cancel-route');
  if (finishButton) finishButton.disabled = pendingRoutePoints.length < 2;
  if (cancelButton) cancelButton.disabled = pendingRoutePoints.length === 0;
}

function addRoutePoint(point) {
  if (!point) return;
  pendingRoutePoints.push(point);
  routePointerPoint = null;
  updateRouteButtons();
  renderRoutes();
}

function finishPendingRoute() {
  const mapData = getMapAnnotations();
  if (!mapData || pendingRoutePoints.length < 2) return;
  mapData.routes.push({
    id: createAnnotationId('route'),
    points: pendingRoutePoints.map((point) => ({ ...point })),
    color: isValidColor(annotationState.settings.routeColor)
      ? annotationState.settings.routeColor
      : '#ffb347',
  });
  pendingRoutePoints = [];
  routePointerPoint = null;
  saveAnnotationState();
  updateRouteButtons();
  renderRoutes();
}

function cancelPendingRoute() {
  pendingRoutePoints = [];
  routePointerPoint = null;
  updateRouteButtons();
  renderRoutes();
}

function removeRoute(routeId) {
  const mapData = getMapAnnotations();
  if (!mapData) return;
  mapData.routes = mapData.routes.filter((route) => route.id !== routeId);
  saveAnnotationState();
  renderRoutes();
}

function syncAnnotationLayers() {
  configureFogCanvas();
  renderShapes();
  renderRoutes();
}

const toolHelp = {
  pan: 'Drag to pan. Use the mouse wheel or pinch to zoom.',
  fog: 'Use Reveal to clear explored ground or Restore fog to correct mistakes.',
  shape: 'Choose a shape, size, and colour, then click the map to place it.',
  route: 'Click POIs or shapes to add stops, then finish the route. Press Escape to return to Pan.',
  erase: 'Click a custom shape or route to remove it.',
};

function setActiveTool(tool) {
  if (!toolHelp[tool]) return;
  if (activeTool === 'fog' && tool !== 'fog' && fogDrawing) {
    finishFogStroke();
  }
  if (activeTool === 'route' && tool !== 'route' && pendingRoutePoints.length) {
    cancelPendingRoute();
  }
  activeTool = tool;

  document.querySelectorAll('.tool-button').forEach((button) => {
    const isActive = button.dataset.tool === tool;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  document.querySelectorAll('[data-options-for]').forEach((options) => {
    options.hidden = options.dataset.optionsFor !== tool;
  });

  const map = document.getElementById('map-image');
  if (map) {
    map.classList.toggle('annotation-active', tool !== 'pan');
    map.classList.toggle('fog-active', tool === 'fog');
    map.classList.toggle(
      'fog-restore-active',
      tool === 'fog' && normalizeFogBrushMode(annotationState.settings.fogBrushMode) === 'restore',
    );
    map.classList.toggle('erase-active', tool === 'erase');
  }
  document.getElementById('tool-help').textContent = toolHelp[tool];

  if (tool !== 'fog') updateBrushPreview(null);
  if (tool !== 'route') routePointerPoint = null;
  renderRoutes();
}

function syncAnnotationControls() {
  const brushSize = Math.min(200, Math.max(20, Number(annotationState.settings.brushSize) || 80));
  const fogBrushMode = normalizeFogBrushMode(annotationState.settings.fogBrushMode);
  const shapeKind = normalizeShapeKind(annotationState.settings.shapeKind);
  const shapeSize = normalizeShapeSize(annotationState.settings.shapeSize);
  const shapeColor = isValidColor(annotationState.settings.shapeColor)
    ? annotationState.settings.shapeColor
    : '#ef5350';
  const routeColor = isValidColor(annotationState.settings.routeColor)
    ? annotationState.settings.routeColor
    : '#ffb347';
  annotationState.settings.brushSize = brushSize;
  annotationState.settings.fogBrushMode = fogBrushMode;
  annotationState.settings.shapeKind = shapeKind;
  annotationState.settings.shapeSize = shapeSize;
  annotationState.settings.shapeColor = shapeColor;
  annotationState.settings.routeColor = routeColor;
  delete annotationState.settings.markerIcon;

  document.getElementById('fog-toggle').checked = Boolean(annotationState.settings.fogEnabled);
  document.getElementById('fog-brush-size').value = String(brushSize);
  document.getElementById('fog-brush-output').textContent = `${brushSize} m`;
  syncFogBrushModeControls();
  document.querySelectorAll('input[name="shape-kind"]').forEach((input) => {
    input.checked = input.value === shapeKind;
  });
  document.getElementById('shape-size').value = String(shapeSize);
  document.getElementById('shape-size-output').textContent = `${shapeSize} px`;
  document.getElementById('shape-color').value = shapeColor;
  document.getElementById('route-color').value = routeColor;
  setFogVisibility();
}

// ─── Maps JSON ───────────────────────────────────────────────────────────────

async function updateMaps() {
  // Loading the generated script works on both http(s):// and file:// URLs.
  // Firefox intentionally blocks fetch() for sibling files opened via file://.
  if (window.TLD_MAPS && typeof window.TLD_MAPS === 'object') {
    maps = window.TLD_MAPS;
    console.log('Maps data loaded from the local catalogue.');
    return;
  }

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

let currentMapId = null;

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
  "ravine": [
    { x: 104, y: 916, w: 150, h: 150, target: "mystery-lake" },
    { x: 1210, y: 1120, w: 150, h: 150, target: "bleak-inlet" },
    { x: 2088, y: 894, w: 150, h: 150, target: "coastal-highway" },
  ],
  "winding-river-&-carter-hydro-dam": [
    { x: 1806, y: 2987, w: 150, h: 150, target: "mystery-lake" },
    { x: 2699, y: 1655, w: 150, h: 150, target: "mystery-lake" },
    { x: 3194, y: 593, w: 150, h: 150, target: "pleasant-valley" },
  ],
  "pleasant-valley": [
    { x: 1159, y: 3798, w: 150, h: 150, target: "winding-river-&-carter-hydro-dam" },
    { x: 4307, y: 3783, w: 150, h: 150, target: "coastal-highway" },
    { x: 3928, y: 51, w: 150, h: 150, target: "timberwolf-mountain" },
    { x: 229, 
      y: 2105, 
      w: 150, 
      h: 150, 
      targets: [
        { name: "Keeper's Pass", id: "keepers-pass" },
        { name: "Blackrock", id: "blackrock" }
      ]
    },
  ],
  "coastal-highway": [
    { x: 321, y: 271, w: 150, h: 150, target: "ravine" },
    { x: 2042, y: 58, w: 150, h: 150, target: "pleasant-valley" },
    { x: 3175, y: 2846, w: 150, h: 150, target: "crumbling-highway" },
  ],
  "crumbling-highway": [
    { x: 125, y: 895, w: 150, h: 150, target: "coastal-highway" },
    { x: 1617, y: 722, w: 150, h: 150, target: "desolation-point" },
  ],
  "desolation-point": [
    { x: 133, y: 976, w: 150, h: 150, target: "crumbling-highway" },
  ],
  "bleak-inlet": [
    { x: 2336, y: 658, w: 150, h: 150, target: "ravine" },
    { x: 1601, y: 793, w: 150, h: 150, target: "forlorn-muskeg" },
  ],
  "keepers-pass": [
    { x: 995, y: 1626, w: 150, h: 150, target: "pleasant-valley" },
    { x: 1562, y: 364, w: 150, h: 150, target: "blackrock" },
  ],
  "blackrock": [
    { x: 2935, y: 2173, w: 150, h: 150, target: "timberwolf-mountain" },
    { x: 1326,
      y: 3251, 
      w: 150, 
      h: 150, 
      targets: [
        { name: "Keeper's Pass", id: "keepers-pass" },
        { name: "Pleasant Valley", id: "pleasant-valley" }
      ] 
    }
  ],
  "timberwolf-mountain": [
    { x: 272, y: 2539, w: 150, h: 150, target: "pleasant-valley" },
    { x: 2736, y: 1891, w: 150, h: 150, target: "ash-canyon" },
    { x: 2561, y: 645, w: 150, h: 150, target: "ash-canyon" },
    { x: 260, y: 843, w: 150, h: 150, target: "blackrock" },
  ],
  "ash-canyon": [
    { x: 2801, y: 2971, w: 150, h: 150, target: "timberwolf-mountain" },
    { x: 1210, y: 2942, w: 150, h: 150, target: "timberwolf-mountain" },
  ],
  "mountain-town": [
    { x: 313, y: 3319, w: 150, h: 150, target: "forlorn-muskeg" },
    { x: 2410, y: 2272, w: 150, h: 150, target: "mystery-lake" },
    { x: 1636, y: 202, w: 150, h: 150, target: "hushed-river-valley" },
  ],
  "hushed-river-valley": [
    { x: 695, y: 2557, w: 150, h: 150, target: "mountain-town" },
  ],
  "broken-railroad": [
    { x: 2208, y: 1341, w: 150, h: 150, target: "forlorn-muskeg" },
    { x: 130, y: 1531, w: 150, h: 150, target: "far-range-branch-line" },
  ],
  "far-range-branch-line": [
    { x: 2850, y: 331, w: 150, h: 150, target: "broken-railroad" },
    { x: 156, y: 728, w: 150, h: 150, target: "transfer-pass" },
  ],
  "transfer-pass": [
    { x: 1500, y: 1878, w: 150, h: 150, target: "far-range-branch-line" },
    { x: 815, y: 1016, w: 150, h: 150, target: "forsaken-airfield" },
    { x: 1580, y: 142, w: 150, h: 150, target: "zone-of-contamination" },
    { x: 568, y: 139, w: 150, h: 150, target: "sundered-pass" },
  ],
  "zone-of-contamination": [
    { x: 2871, y: 2631, w: 150, h: 150, target: "transfer-pass" },
    { x: 294, y: 1664, w: 150, h: 150, target: "langston-mine" },
    { x: 1066, y: 1330, w: 150, h: 150, target: "langston-mine" },
    { x: 922, y: 1080, w: 150, h: 150, target: "langston-mine" },
    { x: 1247,
      y: 2797,
      w: 150, 
      h: 150, 
      targets: [
        { name: "Transition Cave", id: "transition-cave" },
        { name: "Forsaken Airfield", id: "forsaken-airfield" },
        { name: "Sundered Pass", id: "sundered-pass" },
      ] 
    },
  ],
  "sundered-pass": [
    { x: 1387, y: 4244, w: 150, h: 150, target: "transfer-pass" },
    { x: 506, 
      y: 2898, 
      w: 150, 
      h: 150, 
      targets: [
        { name: "Transition Cave", id: "transition-cave" },
        { name: "Forsaken Airfield", id: "forsaken-airfield" },
        { name: "Zone of Contamination", id: "zone-of-contamination" },
      ]  
    },
  ],
  "forsaken-airfield": [
    { x: 3084, y: 4186, w: 150, h: 150, target: "transfer-pass" },
    { x: 4463, 
      y: 2045, 
      w: 150, 
      h: 150, 
      targets: [
        { name: "Transition Cave", id: "transition-cave" },
        { name: "Sundered Pass", id: "sundered-pass" },
        { name: "Zone of Contamination", id: "zone-of-contamination" },
      ]  
    },
  ],
  "langston-mine": [
    { x: -25, y: 974, w: 150, h: 150, target: "zone-of-contamination" },
    { x: 571, y: 89, w: 150, h: 150, target: "zone-of-contamination" },
    { x: 1785, y: 1108, w: 150, h: 150, target: "zone-of-contamination" },
  ],
  "transition-cave": [
    { x: 92, y: 302, w: 150, h: 150, target: "forsaken-airfield" },
    { x: 969, y: 1784, w: 150, h: 150, target: "zone-of-contamination" },
    { x: 1407, y: 727, w: 150, h: 150, target: "sundered-pass" },
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

  const mapImageUrl = maps[mapId] && maps[mapId][currentCategory];
  if (mapImageUrl) {
    const img = document.querySelector('#map-image img');
    img.onload = () => {
      if (currentMapId === mapId) window.requestAnimationFrame(syncAnnotationLayers);
    };
    img.onerror = () => {
      img.alt = 'This region map could not be loaded. Check your internet connection and try again.';
      setAnnotationStatus('Map image could not be loaded', true);
    };
    img.src = mapImageUrl;
    resetTransform();
    document.querySelector('#map-image').classList.add('active');
    if (img.complete && img.naturalWidth) {
      window.requestAnimationFrame(syncAnnotationLayers);
    }
    return true;
  } else {
    console.error('Map URL not found for', mapId, currentCategory);
    return false;
  }
}

function loadMap(mapId, updateHistory = true) {
  if (!maps[mapId] || !maps[mapId][currentCategory]) {
    console.error('Map data is not available for', mapId, currentCategory);
    return;
  }

  cancelPendingRoute();
  currentMapId = mapId;
  document.querySelectorAll('.highlight-overlay').forEach((el) => el.remove());
  showMap(mapId);
  document.getElementById('start-map-image').style.display = 'none';
  document.querySelector('#images-wrapper').style.display = 'block';
  document.body.classList.add('map-open');

  // Adds the map to the browser history
  if (updateHistory) {
    window.history.pushState({ mapId: mapId }, '', `#${mapId}`);
  }
}

function showStartMap(updateHistory = true) {
  cancelPendingRoute();
  currentMapId = null;
  document.getElementById('start-map-image').style.display = 'block';
  document.querySelectorAll('.image-container').forEach((image) => {
    image.classList.remove('active');
  });
  const img = document.querySelector('#map-image img');
  if (img) img.src = '';
  resetTransform();
  document.body.classList.remove('map-open');
  setActiveTool('pan');

  // Clears the hash from the URL and adds to history
  if (updateHistory) {
    window.history.pushState({ mapId: 'home' }, '', window.location.pathname + window.location.search);
  }
}

document.getElementById('homeButton').addEventListener('click', () => showStartMap());

// ─── Drag (mouse) ─────────────────────────────────────────────────────────────

document.querySelectorAll('.image-container').forEach((map) => {
  map.addEventListener('mousedown', (e) => {
    if (!map.classList.contains('active') || activeTool !== 'pan') return;
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
    if (!map.classList.contains('active') || activeTool !== 'pan') return;
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
    if (!map.classList.contains('active') || activeTool !== 'pan') return;
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

const transitionMenu = document.createElement('div');
transitionMenu.className = 'transition-popup';
transitionMenu.style.display = 'none';
document.body.appendChild(transitionMenu);

// Hide the menu if clicking outside of it
document.addEventListener('mousedown', (e) => {
  if (!transitionMenu.contains(e.target)) {
    transitionMenu.style.display = 'none';
  }
});

// --- Passage Click Coordinates Logic ---
const mapContainer = document.querySelector('#map-image');
const mapStage = document.getElementById('map-stage');
let clickStartX = 0;
let clickStartY = 0;

mapContainer.addEventListener('contextmenu', (event) => {
  if (!currentMapId) return;
  event.preventDefault();
  setActiveTool('pan');
});

function finishFogStroke(event) {
  if (!fogDrawing) return;
  fogDrawing = false;
  lastFogPoint = null;
  const pointerId = event && event.pointerId !== undefined ? event.pointerId : fogPointerId;
  if (pointerId !== null && mapStage.hasPointerCapture(pointerId)) {
    mapStage.releasePointerCapture(pointerId);
  }
  fogPointerId = null;
  saveCurrentFog();
}

mapStage.addEventListener('pointerdown', (event) => {
  if (!currentMapId || activeTool === 'pan' || event.button !== 0) return;
  const point = clientPointToMap(event.clientX, event.clientY);
  if (!point) return;

  event.preventDefault();
  event.stopPropagation();

  if (activeTool === 'fog') {
    fogDrawing = true;
    fogPointerId = event.pointerId;
    lastFogPoint = point;
    mapStage.setPointerCapture(event.pointerId);
    applyFogBrushAtPoint(point);
    updateBrushPreview(point);
  } else if (activeTool === 'shape') {
    addShape(point);
  } else if (activeTool === 'route') {
    addRoutePoint(point);
  }
});

mapStage.addEventListener('pointermove', (event) => {
  if (!currentMapId) return;
  const point = clientPointToMap(event.clientX, event.clientY);

  if (activeTool === 'fog') updateBrushPreview(point);
  if (activeTool === 'route' && pendingRoutePoints.length) {
    routePointerPoint = point;
    renderRoutes();
  }

  if (fogDrawing && point) {
    applyFogBrushAtPoint(point, lastFogPoint);
    lastFogPoint = point;
    event.preventDefault();
  }
});

mapStage.addEventListener('pointerup', finishFogStroke);
mapStage.addEventListener('pointercancel', finishFogStroke);
mapStage.addEventListener('pointerleave', () => {
  if (!fogDrawing) updateBrushPreview(null);
  if (activeTool === 'route' && pendingRoutePoints.length) {
    routePointerPoint = null;
    renderRoutes();
  }
});

document.querySelectorAll('.tool-button').forEach((button) => {
  button.addEventListener('click', () => setActiveTool(button.dataset.tool));
});

document.getElementById('fog-toggle').addEventListener('change', (event) => {
  annotationState.settings.fogEnabled = event.target.checked;
  setFogVisibility();
  saveAnnotationState();
});

document.getElementById('fog-brush-size').addEventListener('input', (event) => {
  annotationState.settings.brushSize = Number(event.target.value);
  document.getElementById('fog-brush-output').textContent = `${event.target.value} m`;
});

document.getElementById('fog-brush-size').addEventListener('change', saveAnnotationState);

document.querySelectorAll('[data-fog-mode]').forEach((button) => {
  button.addEventListener('click', () => setFogBrushMode(button.dataset.fogMode));
});

document.getElementById('reset-current-fog').addEventListener('click', () => {
  if (!currentMapId) return;
  if (window.confirm("Reset all explored fog for this map?")) resetCurrentFog();
});

document.querySelectorAll('input[name="shape-kind"]').forEach((input) => {
  input.addEventListener('change', (event) => {
    if (!event.target.checked) return;
    annotationState.settings.shapeKind = normalizeShapeKind(event.target.value);
    saveAnnotationState();
  });
});

document.getElementById('shape-size').addEventListener('input', (event) => {
  annotationState.settings.shapeSize = normalizeShapeSize(event.target.value);
  document.getElementById('shape-size-output').textContent = `${event.target.value} px`;
});

document.getElementById('shape-size').addEventListener('change', saveAnnotationState);

document.getElementById('shape-color').addEventListener('input', (event) => {
  annotationState.settings.shapeColor = event.target.value;
});

document.getElementById('shape-color').addEventListener('change', saveAnnotationState);

document.getElementById('route-color').addEventListener('input', (event) => {
  annotationState.settings.routeColor = event.target.value;
  renderRoutes();
});

document.getElementById('route-color').addEventListener('change', saveAnnotationState);
document.getElementById('finish-route').addEventListener('click', finishPendingRoute);
document.getElementById('cancel-route').addEventListener('click', cancelPendingRoute);

document.getElementById('clear-annotation-data').addEventListener('click', () => {
  const shouldClear = window.confirm(
    'Clear all fog progress, custom shapes, and planned routes from this browser?',
  );
  if (!shouldClear) return;

  localStorage.removeItem(ANNOTATION_STORAGE_KEY);
  annotationState = createDefaultAnnotationState();
  pendingRoutePoints = [];
  routePointerPoint = null;
  syncAnnotationControls();
  if (currentMapId) syncAnnotationLayers();
  setActiveTool('pan');
  setAnnotationStatus('Local data cleared');
});

document.addEventListener('keydown', (event) => {
  if (!currentMapId) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setActiveTool('pan');
    return;
  }
  if (activeTool === 'route' && event.key === 'Enter' && pendingRoutePoints.length >= 2) {
    finishPendingRoute();
  }
});

syncAnnotationControls();
setActiveTool('pan');

mapContainer.addEventListener('mousedown', (e) => {
  clickStartX = e.clientX;
  clickStartY = e.clientY;
});

mapContainer.addEventListener('mouseup', (e) => {
  if (!currentMapId || activeTool !== 'pan') return;

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
      // IF MULTIPLE DESTINATIONS (Floating Menu)
      if (t.targets) {
        transitionMenu.innerHTML = ''; // Clear old buttons
        transitionMenu.style.left = `${e.clientX}px`;
        transitionMenu.style.top = `${e.clientY}px`;
        transitionMenu.style.display = 'flex';

        t.targets.forEach(dest => {
          const btn = document.createElement('button');
          btn.innerText = `To ${dest.name}`;
          btn.onclick = () => {
            transitionMenu.style.display = 'none';
            loadMap(dest.id);
          };
          transitionMenu.appendChild(btn);
        });
      }
      // IF SINGLE DESTINATION (Direct Map Load)
      else if (t.target) {
        console.log(`Transition detected! Loading: ${t.target}`);
        loadMap(t.target);
      }
      break;
    }
  }
});

// ─── Hover effect logic (cursor to pointer) ───────────────────────────────────
mapContainer.addEventListener('mousemove', (e) => {
  if (dragging || !currentMapId || activeTool !== 'pan') {
    mapContainer.style.cursor = '';
    return;
  }

  const transitions = mapTransitions[currentMapId];
  if (!transitions) {
    mapContainer.style.cursor = '';
    return;
  }

  const regionImage = mapContainer.querySelector('img');
  const rect = regionImage.getBoundingClientRect();
  const scaleX = rect.width / regionImage.naturalWidth;
  const scaleY = rect.height / regionImage.naturalHeight;

  const hoverX = (e.clientX - rect.left) / scaleX;
  const hoverY = (e.clientY - rect.top) / scaleY;

  let isHovering = false;
  
  for (const t of transitions) {
    if (
      hoverX >= t.x && hoverX <= t.x + t.w &&
      hoverY >= t.y && hoverY <= t.y + t.h
    ) {
      isHovering = true;
      break;
    }
  }

  mapContainer.style.cursor = isHovering ? 'pointer' : '';
});


// ─── Devoloper tools: Right-click on the red passage in the map ───────────────
// mapContainer.addEventListener('contextmenu', (e) => {
//   e.preventDefault(); // Prevents the default browser context menu
//   if (!currentMapId) return;

//   const regionImage = mapContainer.querySelector('img');
//   const rect = regionImage.getBoundingClientRect();
//   const scaleX = rect.width / regionImage.naturalWidth;
//   const scaleY = rect.height / regionImage.naturalHeight;
  
//   const clickX = Math.round((e.clientX - rect.left) / scaleX);
//   const clickY = Math.round((e.clientY - rect.top) / scaleY);

//   // Considers a 150x150 pixel "target" centered on where you clicked
//   const targetObj = `{ x: ${clickX - 75}, y: ${clickY - 75}, w: 150, h: 150, target: "MAP_NAME" },`;
  
//   console.log("Copy the code below and paste it into your mapTransitions:");
//   console.log(targetObj);
//   alert("Code generated in the Browser Console (F12)!");
// });
