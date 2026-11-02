import {ID, CATEGORIES, TYPES, normalize, safeImage, sourceTraitsFromActor} from "./core.mjs";
import {WITCHER_IMAGES} from "./images.mjs";

export let catalog;
export async function loadCatalog() {
  const response=await fetch(`modules/${ID}/data/catalog.json`);
  if(!response.ok) throw new Error("Não foi possível carregar o catálogo de Drakkenheim.");
  catalog=await response.json();
  return catalog;
}
export function recipes() {
  const changes=game.settings.get(ID,"recipeResults");
  const images=game.settings.get(ID,"recipeImages")??{};
  return [...catalog.recipes,...game.settings.get(ID,"customRecipes")].map(r=>({...r,...changes[r.id],img:safeImage(images[r.id]??r.img,"")}));
}
export const getRecipe = id => recipes().find(r=>r.id===id);
export const components = actor => actor.items.filter(i=>i.getFlag(ID,"kind")==="component" && i.system.quantity>0);
export const knownRecipes = actor => actor.getFlag(ID,"recipes") ?? [];
export const owns = (actor,user=game.user) => actor?.testUserPermission(user,"OWNER");
export function accessibleActors() { return game.actors.filter(a=>a.type==="character" && owns(a)); }
export function primaryGM() {return game.users.activeGM ?? game.users.find(u=>u.active && u.isGM);}
export function monsterFromActor(actor) {
  const matched=catalog.monsters.find(m=>normalize(m.name)===normalize(actor.name));
  const type=actor.system.details?.type?.value ?? actor.system.details?.type;
  return {...matched,id:matched?.id ?? actor.uuid,name:actor.name,type:typeof type==="string" && TYPES[type] ? type : matched?.type ?? "monstrosity",cr:actor.system.details?.cr ?? matched?.cr,portrait:actor.img,uuid:actor.uuid,parts:matched?.parts ?? [],sourceTraits:sourceTraitsFromActor(actor)};
}
let indexPromise;
export async function monsterIndex() {
  indexPromise ??= (async()=>{
    const result=catalog.monsters.map(m=>({...m,key:m.id,source:"Planilha"}));
    for(const actor of game.actors.filter(a=>a.type==="npc")) result.push({...monsterFromActor(actor),key:actor.uuid,source:"Mundo"});
    await Promise.all(game.packs.filter(p=>p.documentName==="Actor" && p.visible).map(async pack=>{
      try {
        const index=await pack.getIndex({fields:["type"]});
        for(const entry of index) if(entry.type==="npc") result.push({name:entry.name,key:`Compendium.${pack.collection}.${entry._id}`,portrait:entry.img,source:pack.metadata.label,uuid:`Compendium.${pack.collection}.${entry._id}`});
      }catch(error){console.warn(`${ID} | Compêndio indisponível: ${pack.collection}`,error);}
    }));
    return result;
  })();
  return indexPromise;
}
export async function resolveMonster(entry) {
  if(!entry.uuid) {
    const actor=game.actors.find(a=>normalize(a.name)===normalize(entry.name));
    return {...entry,portrait:actor?.img ?? entry.portrait,sourceTraits:actor?sourceTraitsFromActor(actor):entry.sourceTraits};
  }
  const actor=await fromUuid(entry.uuid);
  if(!actor || actor.documentName!=="Actor") throw new Error("A criatura não está mais disponível.");
  return monsterFromActor(actor);
}
export function genericParts() {
  const seen=new Set();
  return catalog.ingredients.map(p=>p.category==="animus"?{...p,part:"Animus",name:"Ânima"}:p).filter(p=>p.category && p.part && !seen.has(`${p.category}:${p.part}`) && seen.add(`${p.category}:${p.part}`)).map(p=>({...p,affinities:Object.keys(TYPES)}));
}

// Resolve the wiki's actual image URL, rather than guessing a hashed CDN filename.
const articles={animus:"Monster_essence",bones:"Monster_bone",dust:"Powdered_monster_tissue",fluid:"Monster_blood",hair:"Monster_hair",hide:"Monster_hide",natural:"Monster_claw",organs:"Monster_heart"};
const specific={eyes:"Monster_eye",eye:"Monster_eye",heart:"Monster_heart",brain:"Monster_brain",guts:"Monster_intestines",teeth:"Monster_tooth",claws:"Monster_claw",feathers:"Monster_feather",venom:"Venom_extract",skin:"Monster_hide",scales:"Dragon_scales",glands:"Monster_liver"};
const fallbacks={animus:"icons/magic/unholy/strike-body-life-soul-purple.webp",bones:"icons/commodities/bones/bone-jaw-white.webp",dust:"icons/commodities/materials/powder-grey.webp",fluid:"icons/consumables/potions/vial-cork-red.webp",hair:"icons/commodities/materials/hair-tuft-white.webp",hide:"icons/commodities/leather/fur-brown.webp",natural:"icons/commodities/claws/claw-bear-brown.webp",organs:"icons/skills/wounds/anatomy-organ-heart-red.webp"};
export function componentPreview(part){
  const article=specific[normalize(part.part)]??articles[part.category];
  const configured=game.settings.get(ID,"componentImages")??{},cached=game.settings.get(ID,"wikiImageCache")??{};
  return {src:safeImage(configured[article]??configured[part.category]??cached[article]??WITCHER_IMAGES[article]??WITCHER_IMAGES[articles[part.category]]??fallbacks[part.category],"icons/svg/item-bag.svg"),fallback:fallbacks[part.category]??"icons/svg/item-bag.svg"};
}
const imageChecks=new Map();
function imageAvailable(url){
  if(!imageChecks.has(url))imageChecks.set(url,new Promise(resolve=>{
    const img=new Image();const timer=setTimeout(()=>resolve(false),3500);
    img.onload=()=>{clearTimeout(timer);resolve(true);};img.onerror=()=>{clearTimeout(timer);resolve(false);};img.src=url;
  }));
  return imageChecks.get(url);
}
export async function componentImage(part,override="") {
  if(override) return safeImage(override,"icons/svg/item-bag.svg");
  const configured=game.settings.get(ID,"componentImages");
  const article=specific[normalize(part.part)] ?? articles[part.category];
  if(configured[article] || configured[part.category]) return safeImage(configured[article] ?? configured[part.category]);
  const cached=game.settings.get(ID,"wikiImageCache");
  if(WITCHER_IMAGES[article] && await imageAvailable(WITCHER_IMAGES[article]))return WITCHER_IMAGES[article];
  if(cached[article]) return cached[article];
  try {
    const params=new URLSearchParams({action:"query",format:"json",origin:"*",prop:"pageimages",piprop:"original",redirects:"1",titles:article});
    const response=await fetch(`https://witcher-games.fandom.com/api.php?${params}`,{signal:AbortSignal.timeout(4500),credentials:"omit"});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const url=Object.values(data.query?.pages ?? {}).find(p=>p.original?.source)?.original?.source;
    if(url && /^https:\/\/static\.wikia\.nocookie\.net\//.test(url)) {
      await game.settings.set(ID,"wikiImageCache",{...cached,[article]:url});
      return url;
    }
  }catch(error){ console.info(`${ID} | A wiki não respondeu. Usando ícone local para ${CATEGORIES[part.category]}.`,error.message); }
  const categoryURL=WITCHER_IMAGES[articles[part.category]];
  if(categoryURL && await imageAvailable(categoryURL))return categoryURL;
  return fallbacks[part.category] ?? "icons/svg/item-bag.svg";
}
export const imageArticles=articles;
