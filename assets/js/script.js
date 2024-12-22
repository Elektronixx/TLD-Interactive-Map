let currentCategory = 'pilgrim'; // Default to Pilgrim category

// Map images for each map and difficulty
const maps = {
  'forlorn-muskeg': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481323974/A8EDACD01C767BEDF3FA26B106079FF66A2FF53F/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481324566/5A3CA51E9B96CC0DDBA74E34C5887433456E42B0/',
  },
  'broken-railroad': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481696066/8674195A3C3098E9878C83512BF03B9CF9488AA9/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481696468/C355359C5487B23BF2BBD00EFE4CEA054573F085/',
  },
  'mountain-town': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481699017/E90C0142CCAC23DA2C6C3276ED5C5B495B558E3B/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481699464/16B898F15338D2A5ED837903C88B419569547E32/',
  },
  'hushed-river-valley': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481697948/7AA0DAB2DF429E9628DB12B7925FD7FFEF0199AD/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481698404/CAA4C361027CA65ED8E6FE305F8BC878C60F87B7/',
  },
  'keepers-pass': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481276747/9690CC6CDA2BB2869FAF70E8F2E219986D5FC52D/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481277043/6EFDAE3B58692376CA0E9A5A912846FA1AD7CC09/',
  },
  'bleak-inlet': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481694098/3251230F92F7B16675334CCDF8159FFB4F524D7C/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481694671/37F0FDFC96EC2575E51051571163D20BE40A36D5/',
  },
  'the-ravine': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481701532/3E574FDCD020EC941832AACB3714FDF23ED3FD78/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481702024/B5B784C90D6D2D080F98515DA61F621009947340/',
  },
  'winding-river': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481283290/2F95CDD280AF1BD5D52072DD0B242519C099F433/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481283760/CD74A44711B35D34DC967262E7E90ECAA227B999/',
  },
  'pleasant-valley': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481699824/C9745785ADF9844B76B23DB10D06B151EC80114B/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481700323/6CB3406F97128B65D6508B26FFF117A1221D4EFE/',
  },
  'timberwolf-mountain': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481400687/BC687FC6F0DFC0CF49BD570CC2E3DF82B3FDEA78/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481329519/EAC7153F23C219946789171B226556868ED2614E/',
  },
  'ash-canyon': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481693149/70429F0153C75BC7400704874EEB7891AB33573C/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481693702/16EF030EB787CBC744D8AEC61D4D85F8EC35DE7F/',
  },
  'coastal-highway': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481696951/E170F04CF9718C9422D70BDFA240C5832746D391/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481697237/BCE9865344B16E72C843274B0F413082B4CE9AFD/',
  },
  'crumbling-highway': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481274812/342BCF2DFFECDB3DDA0D51D4ABB53E4B6C9BCB5A/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481274812/342BCF2DFFECDB3DDA0D51D4ABB53E4B6C9BCB5A/',
  },
  'desolation-point': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481332331/1B0B936FB2CEA055BA1C3951C350CDE7B102E2EF/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481332746/E72BAE7FA29DBF76876A59063FF5145FA77FA4EB/',
  },
  'mystery-lake': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481350791/07616FEC9E85DC8552164D0D75C42F8B25DFEA7A/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481351403/DF78A6A5A0F8766BF9AE6D44A7AC658EA6D75A48/',
  },
  blackrock: {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745483478462/F4AF10AC39344BC5FDB2D5464E72573D20817579/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481695550/71900725DE5594C519ECFD95DFBF5A8C7F1AED2C/',
  },
  'far-range-branch-line': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37812669431422742/CD9AF43DCC69CEDC91A49FDEC6E3F3E125049FAD/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37812669431423046/0306E8179F0F09FF0E9DC6AFB823FEB33D62AEF1/',
  },
  'transfer-pass': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481303604/2F143B1F4452AE9F9688686307AEAFE77D64CD0C/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481303971/1A9515074C6E2DFE5960A3886C0534BB20265B41/',
  },
  'forsaken-airfield': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481300633/4D0E18C081174598B9D17AC8E170F0354E7BCC30/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481300997/57442ABAEB646FC2C6BF1AC62DE7D8E84F41D71D/',
  },
  'sundered-pass': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481293800/B618B2F10F9E696C9C9E97DD038F0B75C6ECC331/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481294355/36AAC75152B0D618BE009C5AFD7FDBCD37CA17BD/',
  },
  'zone-of-contamination': {
    pilgrim:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745481297380/BC0F009376B5F60EB884E903629FC6DCBC43A9A2/',
    interloper:
      'https://steamuserimages-a.akamaihd.net/ugc/37814745485571671/C6D652B001FDB57F28C1AE94175A12FD564C4AC6/',
  },
};

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
    zoomLevel = Math.min(Math.max(zoomLevel, 0.5), 3); // Limit zoom level
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
window.addEventListener('load', scaleMapAreas);
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

    areaElements.forEach(el => {
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
        console.log('Overlay created for area:', coords); // Debugging output
      } else {
        console.error('coords attribute missing for element:', el); // Error handling
      }
    });

    // Remove the overlays after the animation duration (3 seconds)
    setTimeout(() => {
      const overlays = document.querySelectorAll('.highlight-overlay');
      overlays.forEach(el => el.remove());
      console.log('Highlight overlays removed'); // Debugging output
    }, 2000); // Duration of the highlight in milliseconds

  }, 1000); // Delay of 2 seconds before running the function
  
});
