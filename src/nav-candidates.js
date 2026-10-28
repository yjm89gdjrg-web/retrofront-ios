// The static grid candidates depend on X/Z cells, never actor height or state.
// Always return a copy: route planning sorts candidates by the exact 3D metric.
export function nearbyNodeLookup(nodes,cellSize,maxEntries=256){
 const byCell=new Map(),cache=new Map();
 for(const node of nodes){const key=Math.round(node.x/cellSize)+','+Math.round(node.z/cellSize);if(!byCell.has(key))byCell.set(key,[]);byCell.get(key).push(node);}
 const lookup=point=>{
  const ix=Math.round(point.x/cellSize),iz=Math.round(point.z/cellSize),key=ix+','+iz;let result=cache.get(key);
  if(result){cache.delete(key);cache.set(key,result);return result.slice();}
  result=[];
  for(let r=0;r<=8;r++)for(let x=ix-r;x<=ix+r;x++)for(let z=iz-r;z<=iz+r;z++){if(r&&Math.abs(x-ix)!==r&&Math.abs(z-iz)!==r)continue;const cell=byCell.get(x+','+z);if(cell)result.push(...cell);}
  if(cache.size>=maxEntries)cache.delete(cache.keys().next().value);cache.set(key,result);return result.slice();
 };
 Object.defineProperty(lookup,'cacheSize',{get:()=>cache.size});return lookup;
}
