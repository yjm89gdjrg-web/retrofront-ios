import fs from 'node:fs/promises';
const root='assets-source/maps/desert-full',map=JSON.parse(await fs.readFile(root+'/map.json','utf8'));
for(const item of [...map.textures,...map.lightmaps,...map.sky])item.uri='data:image/png;base64,'+(await fs.readFile(root+'/'+item.file)).toString('base64');
await fs.writeFile('src/generated/desert-assets.js','// Complete map geometry, original textures and baked lighting; embedded for offline WKWebView.\nexport const DESERT_MAP = '+JSON.stringify(map)+';\n');
console.log('Embedded full CF_DUST2 map: '+map.counts.triangles+' triangles, '+map.counts.textures+' textures.');
