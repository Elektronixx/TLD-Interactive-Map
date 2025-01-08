let currentCategory = 'pilgrim'; // Default to Pilgrim category

// Default map images for each map and difficulty
let maps = {
  // Default map data can be included here if necessary
};

// Function to update the maps object from maps.json
async function updateMaps() {
	try {
		const response = await fetch('assets/js/maps.json'); // Update the path to your maps.json file
		const mapsData = await response.json();
		maps = mapsData;
		console.log('Maps data updated:', maps);
	} catch (error) {
		console.error('Error fetching or processing maps.json:', error);
	}
}

// Function to toggle the difficulty category
function setCategory(difficulty) {
  // Set the selected difficulty
  currentCategory = difficulty;
}

// Function to update the map image based on the selected map and difficulty
function showMap(mapId) {
  // Log the mapId to see which map is being selected
  const images = document.querySelectorAll('.image-container');
  images.forEach((image) => {
    image.classList.remove('active'); // Hide all maps
    image.style.left = '0px'; // Reset position
    image.style.top = '0px'; // Reset position
  });

  // Get the correct map image based on the mapId and current difficulty
  const mapImageUrl = maps[mapId][currentCategory];

  // Set the source of the map image and show the map if the URL is valid
  if (mapImageUrl) {
    document.querySelector('#map-image img').src = mapImageUrl;
    document.querySelector('#map-image').classList.add('active'); // Show the selected map
  } else {
    console.error('Map URL not found for', mapId, currentCategory);
  }
}

// Implementing drag and drop functionality
let dragging = false;
let offsetX = 0,
  offsetY = 0;
let zoomLevel = 1;
document.querySelectorAll('.image-container').forEach((map) => {
  map.addEventListener('mousedown', (e) => {
    if (map.classList.contains('active')) {
      dragging = true;
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
    zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 5); // Limit zoom level
    img.style.transform = `scale(${zoomLevel})`;
    e.preventDefault();
  });
});

// Difficulty button click handler
document.querySelectorAll('.difficulty-buttons button').forEach((button) => {
  button.addEventListener('click', () => {
    // Remove 'active' class from all buttons
    document.querySelectorAll('.difficulty-buttons button').forEach((btn) => {
      btn.classList.remove('active');
    });

    // Add 'active' class to the clicked button
    button.classList.add('active');
    setCategory(button.id.toLowerCase()); // Update category based on button text
  });
});

// Function to load and display the selected map and difficulty
function loadMap(mapId) {
  const overlays = document.querySelectorAll('.highlight-overlay');
  overlays.forEach((el) => el.remove());
  showMap(mapId);
  document.getElementById('start-map-image').style.display = 'none'; // Hide the start page
  document.querySelector('#images-wrapper').style.display = 'block'; // Ensure the image wrapper is visible
}

// Function to scale map areas based on resizing
function scaleMapAreas() {
  const img = document.getElementById('start-map-image');
  const areas = document.querySelectorAll('area');
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  if (!originalWidth || !originalHeight) {
    console.error("Image's natural dimensions could not be retrieved.");
    return;
  }

  const scaleFactorX = img.clientWidth / originalWidth;
  const scaleFactorY = img.clientHeight / originalHeight;

  areas.forEach((area) => {
    const coordsArray = area.getAttribute('coords').split(',').map(Number);
    const scaledCoords = coordsArray.map((coord, index) =>
      Math.round(index % 2 === 0 ? coord * scaleFactorX : coord * scaleFactorY),
    );
    area.setAttribute('coords', scaledCoords.join(','));
  });
}

// Call scaling function on load and resize
window.addEventListener('load', () => {
    scaleMapAreas();
    updateMaps(); // Update maps data on page load
});
window.addEventListener('resize', scaleMapAreas);

// Home button event listener
document.getElementById('homeButton').addEventListener('click', showStartMap);

function showStartMap() {
  // Show the start map and hide any other map
  document.getElementById('start-map-image').style.display = 'block';
  document.querySelectorAll('.image-container').forEach((image) => {
    image.classList.remove('active');
    image.style.left = '0px';
    image.style.top = '0px';
  });
  document.querySelector('#map-image img').src = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const cogIconContainer = document.getElementById('cog-icon');
  const cogIcon = cogIconContainer.querySelector('i');
  const settingsPopup = document.getElementById('settings-popup');

  // Function to toggle the popup and rotate the cog icon
  const togglePopup = () => {
    if (settingsPopup.style.display === 'block') {
      settingsPopup.style.display = 'none';
      cogIcon.classList.remove('rotate');
    } else {
      settingsPopup.style.display = 'block';
      cogIcon.classList.add('rotate');
    }
  };

  // Attach the toggle function to both the cog icon and its container
  cogIconContainer.addEventListener('click', togglePopup);
  cogIcon.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePopup();
  });

  // Close the popup when clicking outside of it
  window.addEventListener('click', (event) => {
    if (
      event.target !== settingsPopup &&
      event.target !== cogIconContainer &&
      !settingsPopup.contains(event.target)
    ) {
      settingsPopup.style.display = 'none';
      cogIcon.classList.remove('rotate');
    }
  });

  // Set a delay of 2 seconds (2000 milliseconds) before running the highlight animation
  setTimeout(() => {
    const overlayContainer = document.getElementById('overlay-container');
    const areaElements = document.querySelectorAll('area');

    areaElements.forEach((el) => {
      // Check if coords attribute exists
      if (el.coords) {
        const coords = el.coords.split(',').map(Number);
        const overlay = document.createElement('div');
        overlay.classList.add('highlight-overlay', 'highlight-aura');
        overlay.style.left = `${coords[0]}px`;
        overlay.style.top = `${coords[1]}px`;
        overlay.style.width = `${coords[2] - coords[0]}px`;
        overlay.style.height = `${coords[3] - coords[1]}px`;
        overlayContainer.appendChild(overlay);
      } else {
        console.error('coords attribute missing for element:', el); // Error handling
      }
    });

    // Remove the overlays after the animation duration (3 seconds)
    setTimeout(() => {
      const overlays = document.querySelectorAll('.highlight-overlay');
      overlays.forEach((el) => el.remove());
      console.log('Highlight overlays removed'); // Debugging output
    }, 5000); // Duration of the highlight in milliseconds
  }, 1000); // Delay of 2 seconds before running the function
});
