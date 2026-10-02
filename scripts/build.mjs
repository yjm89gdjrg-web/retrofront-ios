import { build } from 'esbuild';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
const dest = 'ios/RetroFront/Game';
await mkdir(dest, { recursive: true });
// Resolve only files inside the project; works in restricted build environments too.
await build({ entryPoints: ['src/main.js'], bundle: true, outfile: `${dest}/game.js`, format: 'iife', target: ['safari15'], minify: true, legalComments: 'eof', tsconfigRaw: {}, plugins: [{name:'local-files',setup(api){
  api.onResolve({filter:/.*/},args=>({path:args.path==='three'?path.resolve('node_modules/three/build/three.module.js'):path.resolve(args.importer?path.dirname(args.importer):'.',args.path),namespace:'local'}));
  api.onLoad({filter:/.*/,namespace:'local'},async args=>({contents:await readFile(args.path,'utf8'),loader:'js'}));
}}] });
await Promise.all(['index.html', 'style.css'].map(file => copyFile(`src/${file}`, `${dest}/${file}`)));
await copyFile('node_modules/three/LICENSE', `${dest}/THREE-LICENSE.txt`);
console.log('Offline iOS game bundle ready.');
