const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, 'www');

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

const filesToCopy = [
  'index.html',
  'styles.css',
  'app.js',
  'maps.js',
  'payment.js',
  'supabaseClient.js',
  'app-logo.png',
  'favicon.ico',
  'favicon.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'manifest.json',
  'site.webmanifest'
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(wwwDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} -> www/${file}`);
  } else {
    console.warn(`File not found: ${file}`);
  }
});

console.log('✅ Routemate web assets successfully synced to www/ directory!');
