const fs = require('fs');

function generateSvg(size, isMaskable = false) {
  const rx = isMaskable ? 0 : Math.floor(size * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="${isMaskable ? 0 : 112}" fill="#06110d" />
    <rect x="12" y="12" width="488" height="488" rx="${isMaskable ? 0 : 100}" fill="none" stroke="#f2b705" stroke-width="8" opacity="0.4" />
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f241b" />
        <stop offset="100%" stop-color="#06110d" />
      </linearGradient>
      <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffd23f" />
        <stop offset="100%" stop-color="#f2b705" />
      </linearGradient>
    </defs>
    <!-- M Logo Icon -->
    <path d="M140 160 L195 160 L256 270 L317 160 L372 160 L372 360 L317 360 L317 240 L256 345 L195 240 L195 360 L140 360 Z" fill="url(#gold)" />
    <!-- Crown / Star Accent -->
    <polygon points="256,90 268,124 304,124 275,145 286,178 256,158 226,178 237,145 208,124 244,124" fill="#ffd23f" />
    <circle cx="390" cy="120" r="16" fill="#29d38f" />
  </svg>`;
}

fs.writeFileSync('public/pwa-192.svg', generateSvg(192));
fs.writeFileSync('public/pwa-512.svg', generateSvg(512));
fs.writeFileSync('public/pwa-maskable.svg', generateSvg(512, true));
fs.writeFileSync('public/apple-touch-icon.svg', generateSvg(180));
console.log('PWA SVG icons generated successfully!');
