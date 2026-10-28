import test from 'node:test';import assert from 'node:assert/strict';
import {RecoilMotion,approachAim,visualRecoilScale} from '../src/recoil-motion.js';
test('native gun families have distinct, bounded visual kick without a melee kick',()=>{
 const sampled={};for(const id of ['mp5','m4','ak','awm']){const recoil=new RecoilMotion();assert.equal(recoil.kick(id),true);recoil.update(1/60);sampled[id]=recoil.pose().back;}
 assert.ok(sampled.mp5<sampled.m4&&sampled.m4<sampled.ak&&sampled.ak<sampled.awm);
 const recoil=new RecoilMotion();for(const id of ['knife','axe','shovel','missing'])assert.equal(recoil.kick(id),false);assert.equal(recoil.pose().back,0);
 for(let n=0;n<1000;n++){recoil.kick('ak');recoil.update(.001);const pose=recoil.pose();assert.ok(pose.back<=.08&&Math.abs(pose.side)<=.008&&pose.pitch<=.034);}
 recoil.update(Number.MAX_VALUE);assert.equal(recoil.pose().back,0);
});
test('critically damped recovery and aim transition agree at 30/60/120Hz',()=>{
 const states=[];for(const hz of [30,60,120]){const recoil=new RecoilMotion();recoil.kick('ak');let aim=0;for(let n=0;n<hz/10;n++){recoil.update(1/hz);aim=approachAim(aim,true,1/hz);}states.push({...recoil.pose(),aim});}
 for(const state of states)for(const field of ['back','side','pitch','roll','aim'])assert.ok(Math.abs(state[field]-states[0][field])<1e-12,field);
});
test('pause and invalid time freeze motion while a fresh action can fully reset it',()=>{
 const recoil=new RecoilMotion();recoil.kick('deagle');recoil.update(.025);const before=recoil.pose();for(const dt of [0,-1,NaN,Infinity])recoil.update(dt);assert.deepEqual(recoil.pose(),before);
 const aimed=recoil.pose(true);for(const key of Object.keys(before))assert.equal(aimed[key],before[key]*.5);
 recoil.reset();assert.deepEqual(recoil.pose(),{back:0,lift:0,side:0,pitch:0,roll:0});recoil.kick('m4');recoil.update(2);assert.equal(recoil.pose().back,0);
});
test('shot-time recoil metadata determines scope strength even when aim changed before delivery',()=>{
 assert.equal(visualRecoilScale(.018*.65,.018,false),.65);assert.equal(visualRecoilScale(.018,.018,true),1);assert.equal(visualRecoilScale(undefined,.018,true),.65);
 const hip=new RecoilMotion(),aimed=new RecoilMotion();hip.kick('m4',visualRecoilScale(.018,.018,true));aimed.kick('m4',visualRecoilScale(.018*.65,.018,false));hip.update(.02);aimed.update(.02);assert.ok(Math.abs(aimed.pose().back-hip.pose().back*.65)<1e-12);
});
