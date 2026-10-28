import { deflateSync } from 'node:zlib';
import { mkdir,writeFile } from 'node:fs/promises';
const size=1024,raw=Buffer.alloc((size*3+1)*size);
// Original geometric insignia. Opaque RGB is required for an iOS app icon.
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const line=(x>164&&x<183&&y>160&&y<864)||(x>841&&x<860&&y>160&&y<864)||(y>160&&y<179&&x>164&&x<860)||(y>845&&y<864&&x>164&&x<860);
  const bars=y>305&&y<719&&((x>303&&x<373)||(x>477&&x<547)||(x>651&&x<721));
  const caps=x>273&&x<751&&((y>278&&y<305)||(y>719&&y<746));
  const glow=Math.max(0,1-Math.hypot(x-360,y-250)/1050);let c=line||bars||caps?[211,180,111]:[Math.round(15+glow*16),Math.round(24+glow*19),Math.round(22+glow*15)];
  const at=y*(size*3+1)+1+x*3;raw.set(c,at);
}
const crc=b=>{let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
function chunk(type,data){const t=Buffer.from(type),body=Buffer.concat([t,data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);body.copy(out,4);out.writeUInt32BE(crc(body),out.length-4);return out;}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=2;
const root='ios/RetroFront/Assets.xcassets';await mkdir(`${root}/AppIcon.appiconset`,{recursive:true});
await writeFile(`${root}/AppIcon.appiconset/AppIcon.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
await writeFile(`${root}/Contents.json`,JSON.stringify({info:{author:'xcode',version:1}},null,2));
await writeFile(`${root}/AppIcon.appiconset/Contents.json`,JSON.stringify({images:[{filename:'AppIcon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2));
