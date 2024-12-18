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
	
	// Hide the start map
    document.getElementById('start-map-image').style.display = 'none';

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
 
const burgerButton = document.getElementById('burger-button');
const menuItems = document.getElementById('menu-items');

// Toggle the burger menu and menu visibility
burgerButton.addEventListener('click', () => {
  burgerButton.classList.toggle('open'); // Animate burger to "X"
  menuItems.classList.toggle('open');    // Slide the menu
});

// Add event listeners to all difficulty buttons
document.querySelectorAll('.difficulty-buttons button').forEach(button => {
  button.addEventListener('click', () => {
    // Remove 'active' class from all buttons
    document.querySelectorAll('.difficulty-buttons button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Add 'active' class to the clicked button
    button.classList.add('active');
  });
});

function loadMap(mapId, difficulty) {
  // Set the current difficulty
  toggleCategory(difficulty);
  
  // Display the selected map
  showMap(mapId);

  // Hide the start page
  document.getElementById('start-map').style.display = 'none';

  // Ensure the rest of the interface is visible
  document.querySelector('#images-wrapper').style.display = 'block';
}

function scaleMapAreas() {
  const img = document.getElementById('start-map-image');
  const areas = document.querySelectorAll('area');

  // Dynamically get the image's natural size
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  if (!originalWidth || !originalHeight) {
    console.error("Image's natural dimensions could not be retrieved.");
    return;
  }

  // Calculate the scaling factors based on the displayed size
  const scaleFactorX = img.clientWidth / originalWidth;
  const scaleFactorY = img.clientHeight / originalHeight;

  // Scale each area's coordinates
  areas.forEach(area => {
    const coordsArray = area.getAttribute('coords').split(',').map(Number);

    // Scale and round coordinates
    const scaledCoords = coordsArray.map((coord, index) =>
      Math.round(index % 2 === 0 ? coord * scaleFactorX : coord * scaleFactorY)
    );

    // Update the coords attribute with scaled values
    area.setAttribute('coords', scaledCoords.join(','));
    //console.log(`Updated coords for area: ${scaledCoords.join(',')}`);
  });
}

// Call scaling function on load and resize
window.addEventListener('load', scaleMapAreas);
window.addEventListener('resize', scaleMapAreas);

document.getElementById('homeButton').addEventListener('click', showStartMap);

    function showStartMap() {
        // Show the start map and hide any other map
        document.getElementById('start-map-image').style.display = 'block';

        // Hide all other maps
        const images = document.querySelectorAll('.image-container');
        images.forEach(image => {
            image.classList.remove('active');
            image.style.left = '0px';
            image.style.top = '0px';
        });
    }