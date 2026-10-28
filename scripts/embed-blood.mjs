import {readFile,writeFile,mkdir} from 'node:fs/promises';
export async function generateBlood(){
 const bytes=await readFile('assets-source/vfx/blood/blood_hit_03.png');
 if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==512||bytes.readUInt32BE(20)!==512)throw Error('Expected the original 512 x 512 blood atlas');
 const asset={image:'data:image/png;base64,'+bytes.toString('base64'),columns:4,rows:4,frames:16,fps:30,author:'para',license:'CC0-1.0',source:'https://opengameart.org/content/animated-particle-effects-2'};
 await mkdir('src/generated',{recursive:true});await writeFile('src/generated/blood-asset.js','// Original CC0 atlas by para; see assets-source/vfx/blood/SOURCES.md.\nexport const BLOOD_ASSET='+JSON.stringify(asset)+';\n');
 console.log('Embedded blood hit animation: 16 frames, '+bytes.length+' bytes.');
}
