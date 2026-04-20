const fs = require('fs');
const path = require('path');

const files = [
  'Code.js',
  'Setup.js',
  'Submit.js',
  'Admin.js',
  'Report.js',
  'Ocr.js',
  'Notify.js'
];

let out = '// ===========================================================================\n';
out += '// Mikoshi Kaikei - GAS Backend (All-in-One)\n';
out += '// Generated: ' + new Date().toISOString() + '\n';
out += '// ===========================================================================\n\n';

for (const file of files) {
  const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  out += `// --- File: ${file} ---\n\n`;
  out += content + '\n\n';
}

fs.writeFileSync(path.join(__dirname, 'AllInOne.js'), out, 'utf8');
console.log('Successfully built AllInOne.js');
