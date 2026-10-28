import {Raycaster,Vector3,Box3,Sphere} from 'three';
const cachedBounds=new WeakMap();
const finite=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
function bodyBounds(root){
 const bodies=[];root.updateMatrixWorld(true);root.traverse(node=>{if(node.isSkinnedMesh&&node.visible)bodies.push(node);});
 if(!bodies.length)return null;
 // Compare bone transforms instead of repeatedly skinning every vertex of a settled body.
 const skeletons=new Set(bodies.map(node=>node.skeleton)),pose=[...root.matrixWorld.elements];
 for(const skeleton of skeletons)for(const bone of skeleton.bones)pose.push(...bone.matrixWorld.elements);
 for(const body of bodies)pose.push(...body.matrixWorld.elements);
 const previous=cachedBounds.get(root);if(previous&&bodies.length===previous.bodies.length&&bodies.every((body,i)=>body===previous.bodies[i])&&pose.length===previous.pose.length&&pose.every((n,i)=>n===previous.pose[i]))return previous;
 const bounds=new Box3();for(const body of bodies){body.computeBoundingBox();body.boundingSphere??=new Sphere();body.boundingBox.getBoundingSphere(body.boundingSphere);bounds.union(body.boundingBox.clone().applyMatrix4(body.matrixWorld));}
 const result={pose,bodies,bounds};cachedBounds.set(root,result);return result;
}
// Raycast only the currently displayed skinned body, excluding its gun and team marker.
export function traceCorpseModels(actors,meshFor,origin,direction,maxDistance){
 if(!finite(origin)||!finite(direction)||!Number.isFinite(maxDistance)||maxDistance<=0)return [];
 const dir=new Vector3(...direction);if(dir.lengthSq()<1e-8)return [];dir.normalize();
 const raycaster=new Raycaster(new Vector3(...origin),dir,.001,maxDistance),hits=[];
 for(const actor of actors){
  if(!actor.dead)continue;const root=meshFor(actor);if(!root?.visible)continue;
  const data=bodyBounds(root);if(!data||!raycaster.ray.intersectsBox(data.bounds))continue;
  const hit=raycaster.intersectObjects(data.bodies,false)[0];if(!hit)continue;
  hits.push({id:actor.id,team:actor.team,character:actor.character,distance:hit.distance,position:hit.point.toArray()});
 }
 return hits.sort((a,b)=>a.distance-b.distance);
}
