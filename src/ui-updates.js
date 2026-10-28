// Reading these properties does not force layout. Skip unchanged writes so a
// static HUD keeps its DOM nodes and does not trigger mutation/style work.
export function setText(node,value){const next=String(value);if(node.textContent!==next)node.textContent=next;}
export function setHTML(node,value){if(node.innerHTML!==value)node.innerHTML=value;}
export function setHidden(node,value){const next=!!value;if(node.hidden!==next)node.hidden=next;}
export function setClass(node,name,value){const next=!!value;if(node.classList.contains(name)!==next)node.classList.toggle(name,next);}
export function setAttribute(node,name,value){const next=String(value);if(node.getAttribute(name)!==next)node.setAttribute(name,next);}
const styles=new WeakMap();
export function setStyle(node,name,value){
 const next=String(value);let fields=styles.get(node);if(!fields){fields=new Map();styles.set(node,fields);}
 const last=fields.get(name);if(last?.input===next&&node.style[name]===last.actual)return;
 if(node.style[name]!==next)node.style[name]=next;
 fields.set(name,{input:next,actual:node.style[name]});
}
export function setData(node,name,value){const next=String(value);if(node.dataset[name]!==next)node.dataset[name]=next;}
