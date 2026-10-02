export const WEAPONS = {
  m4: { id:'m4', name:'M4A1', type:'突击步枪', tag:'均衡 · 稳定', damage:27, interval:.105, clip:30, reserve:120, reload:2.15, spread:.008, recoil:.018, range:70, auto:true, color:0x49534c, stats:[72,82,78,68] },
  ak: { id:'ak', name:'AK-47', type:'突击步枪', tag:'高伤害 · 强后坐力', damage:35, interval:.12, clip:30, reserve:90, reload:2.5, spread:.014, recoil:.031, range:70, auto:true, color:0x8e5836, stats:[92,65,72,62] },
  awm: { id:'awm', name:'AWM', type:'栓动狙击枪', tag:'高威力 · 开镜射击', damage:105, interval:1.3, clip:5, reserve:25, reload:3, spread:.032, recoil:.07, range:100, auto:false, color:0x6c7650, stats:[100,96,20,42] },
  mp5: { id:'mp5', name:'MP5', type:'冲锋枪', tag:'高射速 · 轻量', damage:20, interval:.073, clip:30, reserve:150, reload:1.8, spread:.016, recoil:.012, range:38, auto:true, color:0x343e45, stats:[54,68,98,94] },
  usp: { id:'usp', name:'USP', type:'副武器', tag:'可靠 · 半自动', damage:26, interval:.22, clip:12, reserve:48, reload:1.6, spread:.009, recoil:.027, range:40, auto:false, color:0x49534c, stats:[65,77,54,96] },
  knife: { id:'knife', name:'战术匕首', type:'近战武器', tag:'近身作战', damage:65, interval:.6, clip:1, reserve:0, reload:0, spread:0, recoil:0, range:2.6, auto:false, color:0xb0b8b2, stats:[88,100,40,100] }
};
export const CHARACTERS = {
  ranger: { id:'ranger', name:'边境巡卫', english:'BORDER RANGER', color:0x566353, accent:0xb49462, description:'橄榄绿作战服与轻型背心。每一次出发，都为守住身后的阵地。' },
  assault: { id:'assault', name:'城市特勤', english:'URBAN RESPONSE', color:0x3b4d5b, accent:0x819baa, description:'深蓝战术制服与防护头盔。在街巷与掩体之间，保持冷静。' }
};
export const DEFAULT_PROFILE = { primary:'m4', character:'ranger', difficulty:'normal', sensitivity:1, sound:true, quality:'high', side:'attack', wins:0, matches:0 };
export function sanitizeProfile(raw) {
  const p = { ...DEFAULT_PROFILE };
  if (!raw || typeof raw !== 'object') return p;
  if (['m4','ak','awm','mp5'].includes(raw.primary)) p.primary=raw.primary;
  if (CHARACTERS[raw.character]) p.character=raw.character;
  if (['easy','normal','hard'].includes(raw.difficulty)) p.difficulty=raw.difficulty;
  if (['attack','defend'].includes(raw.side)) p.side=raw.side;
  if (['high','low'].includes(raw.quality)) p.quality=raw.quality;
  if (typeof raw.sound === 'boolean') p.sound=raw.sound;
  if (Number.isFinite(raw.sensitivity)) p.sensitivity=Math.max(.3,Math.min(2,raw.sensitivity));
  for (const key of ['wins','matches']) if (Number.isSafeInteger(raw[key]) && raw[key]>=0) p[key]=raw[key];
  return p;
}
