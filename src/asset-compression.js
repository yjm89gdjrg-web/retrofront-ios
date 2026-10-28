import {unzlibSync} from 'three/addons/libs/fflate.module.js';
const owns=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

// Synchronous, offline and compatible with the Safari 15 bundle target.
// The compressed payload is generated locally; it never fetches model data.
export function decodeCompressedJSON(encoded,jsonBytes,format='json'){
 if(!Number.isSafeInteger(jsonBytes)||jsonBytes<1)throw Error('Invalid model JSON length');
 const binary=atob(encoded),packed=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)packed[i]=binary.charCodeAt(i);
 const raw=unzlibSync(packed);if(raw.length!==jsonBytes)throw Error('Model JSON length mismatch');
 const parsed=JSON.parse(new TextDecoder().decode(raw));
 if(format==='json')return parsed;
 if(format!=='string-table-v1')throw Error('Unsupported model JSON encoding');
 return restoreStringTable(parsed);
}

// All original arrays and objects are wrapped, so references cannot collide
// with a user's object keys, array contents or arbitrary short string values.
export function restoreStringTable(packet){
 if(!packet||Array.isArray(packet)||typeof packet!=='object'||Object.keys(packet).length!==3||packet.version!==1||!Array.isArray(packet.strings)||packet.strings.some(value=>typeof value!=='string')||!owns(packet,'root'))throw Error('Invalid model string table');
 const restore=node=>{
  if(node===null||typeof node!=='object')return node;
  if(Array.isArray(node)||Object.keys(node).length!==1)throw Error('Invalid model JSON node');
  if(owns(node,'r')){const index=node.r;if(!Number.isSafeInteger(index)||index<0||index>=packet.strings.length)throw Error('Invalid model string reference');return packet.strings[index];}
  if(owns(node,'a')){if(!Array.isArray(node.a))throw Error('Invalid model JSON array');return node.a.map(restore);}
  if(owns(node,'o')){if(!node.o||Array.isArray(node.o)||typeof node.o!=='object')throw Error('Invalid model JSON object');return Object.fromEntries(Object.entries(node.o).map(([key,value])=>[key,restore(value)]));}
  throw Error('Invalid model JSON node');
 };
 return restore(packet.root);
}
