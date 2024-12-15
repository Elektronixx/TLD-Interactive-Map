let currentCategory = 'pilgrim'; // Default to Pilgrim category

function toggleCategory(category) {
	currentCategory = category;
	document.querySelector('.pilgrim').classList.toggle('active', category === 'pilgrim');
	document.querySelector('.interloper').classList.toggle('active', category === 'interloper');
}

function showMap(mapId) {
	// Hide all maps
	const images = document.querySelectorAll('.image-container');
	images.forEach(image => {
		image.classList.remove('active');
		// Reset styles for inactive maps
		image.style.left = '0px';
		image.style.top = '0px';
	});

	// Show the selected map
	const map = document.getElementById(mapId);
	map.classList.add('active');
	// Ensure the map starts at (0, 0)
	map.style.left = '0px';
	map.style.top = '0px';
}

// Implementing drag and drop functionality
let dragging = false;
let offsetX = 0, offsetY = 0;
let zoomLevel = 1;

document.querySelectorAll('.image-container').forEach(map => {
	map.addEventListener('mousedown', (e) => {
		if (map.classList.contains('active')) {
		dragging = true;

		// Calculate offsets relative to the element's current position
		const computedStyle = window.getComputedStyle(map);
		const currentLeft = parseFloat(computedStyle.left) || 0;
		const currentTop = parseFloat(computedStyle.top) || 0;

		offsetX = e.clientX - currentLeft;
		offsetY = e.clientY - currentTop;

		map.classList.add('dragging');
		e.preventDefault();
	}
});

document.addEventListener('mousemove', (e) => {
	if (dragging) {
		// Update position based on mouse movement and previously calculated offsets
		map.style.left = `${e.clientX - offsetX}px`;
		map.style.top = `${e.clientY - offsetY}px`;
	}
});

document.addEventListener('mouseup', () => {
	dragging = false;
	map.classList.remove('dragging');
});

// Scroll zoom functionality
map.addEventListener('wheel', (e) => {
	const img = map.querySelector('img');
	if (e.deltaY < 0) {
		zoomLevel += 0.1;
	} else {
		zoomLevel -= 0.1;
	}
	zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 3); // Limit zoom level
	img.style.transform = `scale(${zoomLevel})`;
	e.preventDefault();
	});
 });
 
 document.querySelector('.burger-icon').addEventListener('click', function() {
  const menuItems = document.getElementById('menu-items');
  menuItems.classList.toggle('open');  // Toggle the 'open' class to show/hide the menu
});