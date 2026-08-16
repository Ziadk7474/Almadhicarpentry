const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'favicon-src.svg');

async function renderPng(size) {
  return sharp(SRC, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
}

async function main() {
  const icoSizes = [16, 32, 48];
  const icoBuffers = await Promise.all(icoSizes.map(renderPng));
  const icoOutputPath = path.join(ROOT, 'favicon.ico');
  const icoBuffer = await pngToIco(icoBuffers);
  fs.writeFileSync(icoOutputPath, icoBuffer);
  console.log(`Wrote ${path.relative(ROOT, icoOutputPath)} (${icoSizes.join('/')})`);

  const pngTargets = [
    { size: 32, name: 'favicon-32.png' },
    { size: 96, name: 'favicon-96.png' },
    { size: 180, name: 'icon-180.png' },
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  for (const { size, name } of pngTargets) {
    const buffer = await renderPng(size);
    const outputPath = path.join(ROOT, name);
    fs.writeFileSync(outputPath, buffer);
    console.log(`Wrote ${path.relative(ROOT, outputPath)} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
