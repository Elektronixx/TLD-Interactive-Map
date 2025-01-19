// Google Analytics setup script
(function() {
  // Create a script element for loading gtag.js
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-M54Q5FCHXE'; // Replace with your GA4 ID
  document.head.appendChild(script);

  // Initialize gtag once the script is loaded
  script.onload = function() {
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-M54Q5FCHXE'); // Replace with your GA4 ID
  };
})();