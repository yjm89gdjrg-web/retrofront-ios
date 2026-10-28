import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomInt,randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {RoomMatch} from './match.js';
import {sanitizeProfile} from '../src/catalog.js';

const root=fileURLToPath(new URL('../ios/RetroFront/Game/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.json':'application/json'};
export function createRoomServer({port=8787,host='0.0.0.0',maxRooms=20}={}){
  const rooms=new Map();
  const server=http.createServer(async(req,res)=>{
    if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({ok:true,rooms:rooms.size}));return;}
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root)){res.writeHead(403).end();return;}
      const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
    }catch{res.writeHead(404).end('Not found');}
  });
  const wss=new WebSocketServer({server,path:'/rooms',maxPayload:16384,perMessageDeflate:false});
  const send=(ws,data)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1024*1024){ws.close(1013,'Slow connection');return;}ws.send(JSON.stringify(data));}};
  const error=(c,message)=>send(c.ws,{type:'error',message});
  function broadcastRoom(room){
    const state={code:room.code,difficulty:room.difficulty,host:room.members[0].key,phase:room.match?.phase??'waiting',members:room.members.map(m=>({key:m.key,name:m.name,side:m.side,ready:m.ready,character:m.profile.character}))};
    for(const member of room.members)send(member.ws,{type:'room',self:member.key,room:state});
  }
  function leave(c){
    const room=c.room;if(!room)return;c.room=null;room.members=room.members.filter(m=>m!==c);
    if(!room.members.length){rooms.delete(room.code);return;}
    if(room.match){
      const game=room.match,h=game.humans.get(c.key),actor=h&&[game.player,...game.bots].find(a=>a.id===h.id);
      if(actor&&!actor.dead){actor.dead=true;actor.hp=0;actor.deathTime=game.elapsed;game.emit('kill',{id:actor.id,team:actor.team,character:actor.character,killer:null});game.checkElimination();}
      game.humans.delete(c.key);game.members=game.members.filter(m=>m.key!==c.key);
    }
    broadcastRoom(room);
  }
  wss.on('connection',ws=>{
    const c={ws,key:randomUUID(),room:null,alive:true,lastBucket:performance.now(),messages:0};
    if(wss.clients.size>200){ws.close(1013,'Server full');return;}
    ws.on('pong',()=>c.alive=true);ws.on('error',()=>{});ws.on('close',()=>leave(c));
    ws.on('message',raw=>{
      const now=performance.now();if(now-c.lastBucket>1000){c.lastBucket=now;c.messages=0;}if(++c.messages>100){ws.close(1008,'Rate limit');return;}
      let m;try{m=JSON.parse(raw.toString());}catch{return error(c,'消息格式无效');}
      if(!m||typeof m!=='object')return;
      if(m.type==='ping')return send(ws,{type:'pong',time:m.time});
      if(m.type==='leave'){leave(c);return send(ws,{type:'left'});}
      if(m.type==='create'||m.type==='join'){
        if(c.room)return error(c,'请先退出当前房间');
        let room;
        if(m.type==='create'){
          if(rooms.size>=maxRooms)return error(c,'服务器房间已满，请稍后重试');
          let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));
          room={code,difficulty:['easy','normal','hard'].includes(m.difficulty)?m.difficulty:'normal',members:[],match:null,tick:0};rooms.set(code,room);
        }else{
          room=rooms.get(String(m.code??'').trim());if(!room)return error(c,'房间不存在，请检查房间号和服务器地址');
          if(room.match&&room.match.phase!=='finished')return error(c,'房间正在对局，请等待本场结束');
          if(room.members.length>=10)return error(c,'房间已满（10 人）');
        }
        c.name=typeof m.name==='string'?m.name.trim().slice(0,16):'';c.name||='玩家';c.profile=sanitizeProfile(m.profile);c.ready=false;
        const preferred=c.profile.side;c.side=room.members.filter(p=>p.side===preferred).length<5?preferred:(preferred==='attack'?'defend':'attack');
        c.room=room;room.members.push(c);broadcastRoom(room);return;
      }
      const room=c.room;if(!room)return error(c,'请先创建或加入房间');
      const waiting=!room.match||room.match.phase==='finished';
      if(m.type==='input'){room.match?.inputFor(c.key,m.input,now);return;}
      if(m.type==='command'){room.match?.command(c.key,m.action,m.value);return;}
      if(m.type==='ready'&&waiting){c.ready=!c.ready;broadcastRoom(room);return;}
      if(m.type==='side'&&waiting){
        if(!['attack','defend'].includes(m.side))return;
        if(room.members.filter(p=>p!==c&&p.side===m.side).length>=5)return error(c,'这一方已满 5 人');
        c.side=m.side;c.ready=false;broadcastRoom(room);return;
      }
      if(m.type==='start'){
        if(c!==room.members[0])return error(c,'只有房主可以开始');
        if(!waiting)return error(c,'对局已经开始');
        if(room.members.some(p=>p!==c&&!p.ready))return error(c,'请等待其他玩家准备');
        room.match=new RoomMatch(room.members.map(p=>({key:p.key,name:p.name,side:p.side,profile:p.profile})),room.difficulty);
        const events=room.match.events.splice(0);for(const p of room.members){p.ready=false;send(p.ws,{type:'start',snapshot:room.match.snapshot(p.key,events)});}broadcastRoom(room);
      }
    });
    c.heartbeat=setInterval(()=>{if(!c.alive){ws.terminate();return;}c.alive=false;ws.ping();},15000);c.heartbeat.unref();ws.on('close',()=>clearInterval(c.heartbeat));
  });
  let last=performance.now(),accumulator=0;
  const timer=setInterval(()=>{
    const now=performance.now();accumulator+=Math.min((now-last)/1000,.15);last=now;
    while(accumulator>=1/30){
      accumulator-=1/30;
      for(const room of rooms.values()){
        if(!room.match||room.match.phase==='finished')continue;
        room.match.update(1/30,now);room.tick++;
        if(room.tick%2===0||room.match.phase==='finished'){
          const events=room.match.events.splice(0);for(const p of room.members)send(p.ws,{type:'snapshot',snapshot:room.match.snapshot(p.key,events)});
          if(room.match.phase==='finished'){
            for(const p of room.members){const state=room.match.humans.get(p.key)?.state;if(state)p.profile=state.profile;}
            broadcastRoom(room);
          }
        }
      }
    }
  },1000/30);timer.unref();
  const ready=new Promise(resolve=>server.listen(port,host,()=>resolve(server.address())));
  return {server,wss,rooms,ready,close:async()=>{
    clearInterval(timer);
    const stopped=new Promise(resolve=>server.close(resolve));
    for(const client of wss.clients)client.terminate();
    server.closeAllConnections();
    await new Promise(resolve=>wss.close(resolve));await stopped;
  }};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createRoomServer({port:Number(process.env.PORT)||8787,host:process.env.HOST||'0.0.0.0'});
  app.ready.then(address=>console.log(`RetroFront rooms: http://${address.address}:${address.port} (WebSocket /rooms)`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}
