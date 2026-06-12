import sharp from 'sharp';
import fs from 'fs';

const svg = fs.readFileSync('public/icons.svg');

async function run() {
  await sharp(svg).resize(192, 192).png().toFile('public/icons/icon-192.png');
  console.log('192 done');
  await sharp(svg).resize(512, 512).png().toFile('public/icons/icon-512.png');
  console.log('512 done');
}

run().catch(console.error);
