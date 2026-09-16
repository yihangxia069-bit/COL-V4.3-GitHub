import { cloneProject, createCharacterCard } from "./state.js";

const P = "colProject";
const C = "colCharacter";
const RC = "colRoleCards";
const S = "colSnapshots";
const B = "colBackup";
const F = "colFavorites";
const MAX_SNAPSHOTS = 8;
const MAX_FAVORITES = 24;

const read = (k, fallback = null) => {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
};
const write = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); };
const bucket = (name) => read(`COL:${name}`, {});
const saveBucket = (name, value) => write(`COL:${name}`, value);

export function fingerprint(obj) {
  const s = JSON.stringify(obj);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export async function saveProject(project, label = "manual") {
  const coreChanged = project.meta.coreFingerprint && project.meta.coreFingerprint !== fingerprint(project.characterCore);
  project.meta.coreFingerprint = fingerprint(project.characterCore);
  project.meta.lastSavedAt = Date.now();
  project.meta.saveCount = (project.meta.saveCount || 0) + 1;
  project.meta.lastSaveLabel = label;
  if (label !== "autosave") await backupProject(project.code);
  const b = bucket(P); b[project.code] = cloneProject(project); saveBucket(P,b);
  return { ok: true, coreChanged, at: project.meta.lastSavedAt };
}
async function backupProject(code) {
  const prev = await loadProject(code);
  if (prev) { const b=bucket(B); b[code]={ts:Date.now(),data:prev}; saveBucket(B,b); }
}
export async function loadBackup(code) {
  const b=bucket(B); return b[code]?.data || null;
}
export async function saveCharacter(project) {
  const coreChanged = project.meta.coreFingerprint && project.meta.coreFingerprint !== fingerprint(project.characterCore);
  project.meta.coreFingerprint = fingerprint(project.characterCore);
  const card=createCharacterCard(project);
  const c=bucket(C); c[project.code]=card; saveBucket(C,c);
  const r=bucket(RC); r[project.code]=card; saveBucket(RC,r);
  return {ok:true,coreChanged,at:Date.now()};
}
export async function loadProject(code) { return bucket(P)[code] || null; }
export async function loadCharacter(code) { return bucket(C)[code] || bucket(RC)[code] || null; }
export async function listCharacters() {
  const maps=new Map();
  for(const name of [RC,C]) for(const [key,v] of Object.entries(bucket(name))) {
    if(!v) continue; const code=v.code||key; maps.set(code,{code,name:v.name||code,savedAt:v.savedAt||0});
  }
  return [...maps.values()].sort((a,b)=>String(a.code).localeCompare(String(b.code)));
}
export async function saveCharacterCard(card) {
  if(!card||!card.code||!card.characterCore) return {ok:false,error:"无效角色卡"};
  const data=cloneProject(card); data.format="COL_CHARACTER_CARD"; data.formatVersion=1; data.savedAt=Date.now();
  const c=bucket(C); c[data.code]=data; saveBucket(C,c); const r=bucket(RC); r[data.code]=data; saveBucket(RC,r);
  return {ok:true,at:data.savedAt,code:data.code};
}
export function exportCharacterCard(project) { return JSON.stringify(createCharacterCard(project),null,2); }
export function importCharacterCard(text) {
  const c=JSON.parse(text);
  if(!c||!c.code||!c.characterCore||!Array.isArray(c.characterCore.groups)) throw new Error("不是有效的 COL 角色卡");
  c.characterCore.locked=true; return c;
}
export async function savedAt(code) { const p=await loadProject(code); return p?p.meta.lastSavedAt:null; }
export async function snapshot(project,label) {
  const b=bucket(S), key=String(Date.now()); b[key]={label:label||"snapshot",ts:Date.now(),data:cloneProject(project)};
  const keys=Object.keys(b).sort(); while(keys.length>MAX_SNAPSHOTS) delete b[keys.shift()]; saveBucket(S,b); return {ok:true,key};
}
export async function listSnapshots() {
  return Object.entries(bucket(S)).map(([k,v])=>({key:k,label:v.label,ts:v.ts,size:JSON.stringify(v.data||{}).length})).sort((a,b)=>b.ts-a.ts);
}
export async function restoreSnapshot(key) { return bucket(S)[key]?.data || null; }
export function exportJson(project) { return JSON.stringify(project,null,2); }
export function importJson(text) {
  const p=JSON.parse(text); if(!p||!p.characterCore||!p.overrides) throw new Error("不是有效的 COL 项目文件"); return p;
}
export async function addFavorite(entry) {
  const b=bucket(F),key=String(Date.now()); b[key]={key,ts:Date.now(),...entry};
  const keys=Object.keys(b).sort(); while(keys.length>MAX_FAVORITES) delete b[keys.shift()]; saveBucket(F,b); return {ok:true,key};
}
export async function listFavorites() {
  return Object.entries(bucket(F)).map(([k,v])=>({key:k,ts:v.ts||Number(k)||0,label:v.label||"",dataUrl:v.dataUrl||"",prompt:v.prompt||"",negativePrompt:v.negativePrompt||"",seed:v.seed,resolution:v.resolution||"",layers:v.layers||[]})).sort((a,b)=>b.ts-a.ts);
}
export async function deleteFavorite(key) { const b=bucket(F); delete b[key]; saveBucket(F,b); return {ok:true}; }
