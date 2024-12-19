let currentCategory = 'pilgrim'; // Default to Pilgrim category

// Map images for each map and difficulty
const maps = {
    'mystery-lake': {
        'pilgrim': 'https://steamuserimages-a.akamaihd.net/ugc/37814745481350791/07616FEC9E85DC8552164D0D75C42F8B25DFEA7A/',
        'interloper': 'https://steamuserimages-a.akamaihd.net/ugc/37814745481351403/DF78A6A5A0F8766BF9AE6D44A7AC658EA6D75A48/'
    },
    'ash-canyon': {
        'pilgrim': 'https://example.com/ash-canyon-pilgrim.jpg',
        'interloper': 'https://example.com/ash-canyon-interloper.jpg'
    },
    'broken-rail': {
        'pilgrim': 'https://example.com/broken-rail-pilgrim.jpg',
        'interloper': 'https://example.com/broken-rail-interloper.jpg'
    },
    // Add other maps here...
};

// Function to toggle the difficulty category
function setCategory(difficulty) {
    // Set the selected difficulty
    currentCategory = difficulty;
}
function getCategory() {
    return currentCategory;
}

// Function to update the map image based on the selected map and difficulty
function showMap(mapId) {
    // Log the mapId to see which map is being selected
    const images = document.querySelectorAll('.image-container');
    images.forEach(image => {
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
let offsetX = 0, offsetY = 0;
let zoomLevel = 1;
document.querySelectorAll('.image-container').forEach(map => {
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
        zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 3); // Limit zoom level
        img.style.transform = `scale(${zoomLevel})`;
        e.preventDefault();
    });
});

// Burger menu toggle
const burgerButton = document.getElementById('burger-button');
const menuItems = document.getElementById('menu-items');
burgerButton.addEventListener('click', () => {
    burgerButton.classList.toggle('open');
    menuItems.classList.toggle('open');
});

// Difficulty button click handler
document.querySelectorAll('.difficulty-buttons button').forEach(button => {
    button.addEventListener('click', () => {
        // Remove 'active' class from all buttons
        document.querySelectorAll('.difficulty-buttons button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add 'active' class to the clicked button
        button.classList.add('active');
        setCategory(button.id.toLowerCase()); // Update category based on button text
    });
});

// Function to load and display the selected map and difficulty
function loadMap(mapId) {
    showMap(mapId);
    document.getElementById('start-map-image').style.display = 'none';  // Hide the start page
    document.querySelector('#images-wrapper').style.display = 'block';  // Ensure the image wrapper is visible
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

    areas.forEach(area => {
        const coordsArray = area.getAttribute('coords').split(',').map(Number);
        const scaledCoords = coordsArray.map((coord, index) =>
            Math.round(index % 2 === 0 ? coord * scaleFactorX : coord * scaleFactorY)
        );
        area.setAttribute('coords', scaledCoords.join(','));
    });
}

// Call scaling function on load and resize
window.addEventListener('load', scaleMapAreas);
window.addEventListener('resize', scaleMapAreas);

// Home button event listener
document.getElementById('homeButton').addEventListener('click', showStartMap);

function showStartMap() {
    // Show the start map and hide any other map
    document.getElementById('start-map-image').style.display = 'block';
    document.querySelectorAll('.image-container').forEach(image => {
        image.classList.remove('active');
        image.style.left = '0px';
        image.style.top = '0px';
    });
}

const img = document.querySelector('#start-map-image');
console.log('Natural size:', img.naturalWidth, img.naturalHeight);
console.log('Rendered size:', img.clientWidth, img.clientHeight);
