import {sanitizeHudLayout} from './control-layout-config.js';
import {sanitizeAimSettings} from './aim-controls.js';
export const WEAPONS = {
  m4: { id:'m4', name:'M4A1', type:'突击步枪', tag:'均衡 · 稳定', damage:27, interval:.105, clip:30, reserve:120, reload:2.15, spread:.008, recoil:.018, range:70, auto:true, color:0x49534c, stats:[72,82,78,68] },
  ak: { id:'ak', name:'AK-47', type:'突击步枪', tag:'高伤害 · 强后坐力', damage:35, interval:.12, clip:30, reserve:90, reload:2.5, spread:.014, recoil:.031, range:70, auto:true, color:0x8e5836, stats:[92,65,72,62] },
  awm: { id:'awm', name:'AWM · 翡翠', scoped:true, type:'栓动狙击枪', tag:'高威力 · 开镜射击', damage:105, interval:1.3, clip:5, reserve:25, reload:3, spread:.032, recoil:.07, range:100, auto:false, color:0x6c7650, stats:[100,96,20,42] },
  mp5: { id:'mp5', name:'MP5 · 消音型', type:'冲锋枪', tag:'高射速 · 轻量', damage:20, interval:.073, clip:30, reserve:150, reload:1.8, spread:.016, recoil:.012, range:38, auto:true, color:0x343e45, stats:[54,68,98,94] },
  usp: { id:'usp', name:'USP', type:'副武器', tag:'可靠 · 半自动', damage:26, interval:.22, clip:12, reserve:48, reload:1.6, spread:.009, recoil:.027, range:40, auto:false, color:0x49534c, stats:[65,77,54,96] },
  knife: { id:'knife', name:'战术匕首', type:'近战武器', tag:'近身作战', damage:65, interval:.6, clip:1, reserve:0, reload:0, spread:0, recoil:0, range:2.6, auto:false, color:0xb0b8b2, stats:[88,100,40,100] },
  scar: {id:'scar',name:'SCAR-Light',type:'突击步枪',tag:'低后坐力 · 轻型步枪',damage:30,interval:.105,clip:30,reserve:90,reload:2.4,spread:.009,recoil:.016,range:70,auto:true,color:0xb19b69,stats:[78,85,78,78]},
  an94: {id:'an94',name:'AN94',type:'突击步枪',tag:'稳健连射 · 经典黑枪',damage:32,interval:.11,clip:30,reserve:90,reload:2.6,spread:.01,recoil:.019,range:70,auto:true,color:0x323b3e,stats:[84,82,76,65]},
  m700: {id:'m700',name:'M700',scoped:true,type:'栓动狙击枪',tag:'轻便狙击 · 快速回位',damage:88,interval:1.05,clip:10,reserve:40,reload:2.6,spread:.026,recoil:.052,range:100,auto:false,color:0x687450,stats:[93,94,29,67]},
  deagle: {id:'deagle',name:'沙漠之鹰',type:'副武器',tag:'大口径 · 强力单发',damage:48,interval:.32,clip:7,reserve:35,reload:2.1,spread:.012,recoil:.046,range:45,auto:false,color:0xb5bac0,stats:[91,76,40,84]},
  anaconda: {id:'anaconda',name:'Anaconda 左轮',type:'副武器',tag:'六发弹巢 · 高威力',damage:51,interval:.38,clip:6,reserve:36,reload:2.6,spread:.011,recoil:.05,range:45,auto:false,color:0xb3b6b3,stats:[95,80,32,80]},
  colt1911: {id:'colt1911',name:'柯尔特 M1911',type:'副武器',tag:'经典手枪 · 快速拔枪',damage:32,interval:.21,clip:8,reserve:48,reload:1.9,spread:.008,recoil:.027,range:40,auto:false,color:0x45494b,stats:[73,82,58,96]},
  axe: {id:'axe',name:'手斧',type:'近战武器',tag:'劈砍攻击 · 高伤害',damage:85,interval:.78,clip:1,reserve:0,reload:0,spread:0,recoil:0,range:2.5,auto:false,color:0x73746c,stats:[96,100,31,92]},
  shovel: {id:'shovel',name:'工兵铲',type:'近战武器',tag:'较远距离 · 挥铲攻击',damage:80,interval:.86,clip:1,reserve:0,reload:0,spread:0,recoil:0,range:3.1,auto:false,color:0x5e6652,stats:[93,100,26,87]}
};
export const WEAPON_SLOTS={primary:['m4','ak','awm','mp5','scar','an94','m700'],secondary:['usp','deagle','anaconda','colt1911'],melee:['knife','axe','shovel']};
export const SLOT_LABELS={primary:'主武器',secondary:'副武器',melee:'近战武器'};
for(const [slot,ids] of Object.entries(WEAPON_SLOTS))for(const id of ids)WEAPONS[id].slot=slot;
export const CHARACTERS = {
  yun: {id:'yun',name:'云悠悠',english:'YUN YOUYOU',model:'yun-gr',playerOnly:true,requiresUnlock:true,color:0x465381,accent:0xc999b8,description:'玩家专属 · 紫发、蓝紫裙装与黑色长袜。采用端游风格的社区保卫者模型，配有中文击杀语音；两方均使用此装束。'},
  omoh: {id:'omoh',name:'奥摩',english:'OMOH',color:0x3b4d5b,accent:0x819baa,description:'经典潜伏者作战装束。冷静、坚毅，始终守住自己的阵地。'},
  fox: {id:'fox',name:'灵狐者',english:'FOX',color:0x74594f,accent:0xc39c83,description:'灵狐者双阵营装束。仓库展示保卫者外观，战场上随阵营切换。'},
  star: {id:'star',name:'STAR · 待核对',english:'STAR / SOV',color:0x343e55,accent:0xada1b7,description:'夜玫瑰候选外观，名称与装束仍待核对。'},
};
export const BOT_CHARACTERS=Object.freeze(Object.keys(CHARACTERS).filter(id=>!CHARACTERS[id].playerOnly));
export function availableCharacters(profile){return Object.keys(CHARACTERS).filter(id=>!CHARACTERS[id].requiresUnlock||(Array.isArray(profile?.unlockedCharacters)&&profile.unlockedCharacters.includes(id)));}
export function redeemCharacterCode(profile,input){
 const code=typeof input==='string'?input.trim():'';
 if(!code)return 'empty';
 if(code!=='184771')return 'invalid';
 if(availableCharacters(profile).includes('yun'))return 'already';
 profile.unlockedCharacters=[...(Array.isArray(profile.unlockedCharacters)?profile.unlockedCharacters:[]),'yun'];
 return 'unlocked';
}
export const DEFAULT_PROFILE = { primary:'m4', secondary:'usp', melee:'knife', character:'omoh', difficulty:'normal', sensitivity:1, aimSensitivity:.5, scopeSensitivity:.5, showFPS:false, sound:true, music:true, quality:'high', side:'attack', wins:0, matches:0 };
export const BACKPACK_COUNT=5;
const starterBags=[['m4','usp','knife'],['ak','deagle','knife'],['awm','usp','knife'],['mp5','colt1911','axe'],['scar','anaconda','shovel']];
export function selectBackpack(profile,index){
  if(!Number.isInteger(index)||index<0||index>=BACKPACK_COUNT||!profile.backpacks?.[index])return false;
  profile.activeBackpack=index;Object.assign(profile,profile.backpacks[index]);return true;
}
export function equipBackpackWeapon(profile,slot,id){
  if(!WEAPON_SLOTS[slot]?.includes(id))return false;
  profile.backpacks[profile.activeBackpack][slot]=id;profile[slot]=id;return true;
}
export function sanitizeProfile(raw) {
  const p = { ...DEFAULT_PROFILE, hudLayout:sanitizeHudLayout(raw?.hudLayout) };
  if (!raw || typeof raw !== 'object')raw={};
  for(const [slot,ids] of Object.entries(WEAPON_SLOTS))if(ids.includes(raw[slot]))p[slot]=raw[slot];
  p.backpacks=starterBags.map((weapons,index)=>{
    const source=Array.isArray(raw.backpacks)?raw.backpacks[index]:index===0?p:null;
    return Object.fromEntries(Object.keys(WEAPON_SLOTS).map((slot,i)=>[slot,WEAPON_SLOTS[slot].includes(source?.[slot])?source[slot]:weapons[i]]));
  });
  selectBackpack(p,Number.isInteger(raw.activeBackpack)&&raw.activeBackpack>=0&&raw.activeBackpack<BACKPACK_COUNT?raw.activeBackpack:0);
  p.unlockedCharacters=Array.isArray(raw.unlockedCharacters)?Object.keys(CHARACTERS).filter(id=>CHARACTERS[id].requiresUnlock&&raw.unlockedCharacters.includes(id)):[];
  if (availableCharacters(p).includes(raw.character)) p.character=raw.character;
  if (['easy','normal','hard'].includes(raw.difficulty)) p.difficulty=raw.difficulty;
  if (['attack','defend'].includes(raw.side)) p.side=raw.side;
  if (['high','low'].includes(raw.quality)) p.quality=raw.quality;
  if (typeof raw.sound === 'boolean') p.sound=raw.sound;
  if (typeof raw.music === 'boolean') p.music=raw.music;
  Object.assign(p,sanitizeAimSettings(raw));
  if(typeof raw.showFPS==='boolean')p.showFPS=raw.showFPS;
  for (const key of ['wins','matches']) if (Number.isSafeInteger(raw[key]) && raw[key]>=0) p[key]=raw[key];
  return p;
}
