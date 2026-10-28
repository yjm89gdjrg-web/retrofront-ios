const {generateCF}=await import('./convert-cf.mjs');generateCF();
const {generateBlood}=await import('./embed-blood.mjs');await generateBlood();
await import('./embed-full-desert.mjs');
import { build } from 'esbuild';
import { mkdir, copyFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
const dest = 'ios/RetroFront/Game';
await mkdir(dest, { recursive: true });
// Resolve only files inside the project; works in restricted build environments too.
await build({ entryPoints: ['src/main.js'], bundle: true, outfile: `${dest}/game.js`, format: 'iife', target: ['safari15'], minify: true, legalComments: 'eof', tsconfigRaw: {}, plugins: [{name:'local-files',setup(api){
  api.onResolve({filter:/.*/},args=>({path:args.path==='three'?path.resolve('node_modules/three/build/three.module.js'):args.path.startsWith('three/addons/')?path.resolve('node_modules/three/examples/jsm',args.path.slice('three/addons/'.length)):path.resolve(args.importer?path.dirname(args.importer):'.',args.path),namespace:'local'}));
  api.onLoad({filter:/.*/,namespace:'local'},async args=>({contents:await readFile(args.path,'utf8'),loader:'js'}));
}}] });
await Promise.all(['index.html', 'style.css', 'lobby.css', 'hud.css', 'backpacks.css'].map(file => copyFile(`src/${file}`, `${dest}/${file}`)));
async function copyDirectory(from,to){await mkdir(to,{recursive:true});for(const file of await readdir(from,{withFileTypes:true})){const a=path.join(from,file.name),b=path.join(to,file.name);if(file.isDirectory())await copyDirectory(a,b);else if(file.isFile())await copyFile(a,b);}}
await copyDirectory('src/assets',`${dest}/assets`);
await copyFile('node_modules/three/LICENSE', `${dest}/THREE-LICENSE.txt`);
await copyFile('FFLATE-LICENSE.txt', `${dest}/FFLATE-LICENSE.txt`);
console.log('Offline iOS game bundle ready.');
