import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public')

const sizes = [
  { name: 'logo-400.png', size: 400, fontSize: 56, letterSpacing: -1 },
  { name: 'logo-300.png', size: 300, fontSize: 42, letterSpacing: -1 },
]

function buildSvg(size, fontSize, letterSpacing) {
  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.12)}" fill="#020817"/>
  <text
    x="${size / 2}"
    y="${size / 2 + fontSize * 0.38}"
    font-family="'Menlo', 'Monaco', 'Courier New', monospace"
    font-size="${fontSize}"
    font-weight="700"
    letter-spacing="${letterSpacing}"
    text-anchor="middle"
  >
    <tspan fill="#ffffff">folio</tspan><tspan fill="#818cf8">-ai</tspan>
  </text>
</svg>`.trim()
}

for (const { name, size, fontSize, letterSpacing } of sizes) {
  const svg = Buffer.from(buildSvg(size, fontSize, letterSpacing))
  const outPath = resolve(outDir, name)
  await sharp(svg).png().toFile(outPath)
  console.log(`✓ ${outPath}`)
}
