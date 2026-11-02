/** Pure rules: no Foundry globals. Kept separate for repeatable verification. */
export const ID = "selos-de-drakkenheim";
export const RARITIES = {common:"Comum",uncommon:"Incomum",rare:"Raro",veryRare:"Muito raro",legendary:"Lendário"};
export const CATEGORIES = {animus:"Ânima",bones:"Ossos",dust:"Pó",fluid:"Fluido",hair:"Pelo",hide:"Couro",natural:"Arma natural",organs:"Órgãos"};
export const TYPES = {aberration:"Aberração",beast:"Fera",celestial:"Celestial",construct:"Constructo",dragon:"Dragão",elemental:"Elemental",fey:"Feérico",fiend:"Ínfero",giant:"Gigante",humanoid:"Humanoide",monstrosity:"Monstruosidade",ooze:"Limo",plant:"Planta",undead:"Morto-vivo"};
export const normalize = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const assert = (value, message) => { if (!value) throw new Error(message); };
export const HARVEST_TOOLS_NAME = "Monster Harvesting Tools";
export const HARVEST_TOOLS_REQUIRED = `Para coletar, o personagem precisa de um item do tipo Contêiner (Container) chamado "${HARVEST_TOOLS_NAME}" no próprio inventário.`;
export function harvestTools(actor) {
  return actor?.items?.find(item=>item.type==="container" && normalize(item.name)===normalize(HARVEST_TOOLS_NAME) && Number(item.system?.quantity)>0);
}
export function requireHarvestTools(actor) {
  const tools=harvestTools(actor);
  assert(tools,HARVEST_TOOLS_REQUIRED);
  return tools;
}
export function rarityFromCR(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(",", ".");
  const n = text.includes("/") ? text.split("/").map(Number).reduce((a,b)=>a/b) : Number(text);
  if (!Number.isFinite(n) || n < 0.25) return null;
  return n < 1 ? "common" : n < 5 ? "uncommon" : n < 11 ? "rare" : n < 17 ? "veryRare" : "legendary";
}
export function studyLimit(actor, mode="score") {
  return Math.max(0, Math.floor(Number(actor.system?.abilities?.int?.[mode === "modifier" ? "mod" : "value"]) || 0));
}
export function safeImage(value, fallback="icons/svg/mystery-man.svg") {
  const s = String(value ?? "").trim();
  if (!s || /[<>"'\x00-\x1f]/.test(s) || s.includes("\\")) return fallback;
  if (/^https?:\/\//i.test(s) || (!/^[a-z][a-z\d+.-]*:/i.test(s) && !s.startsWith("//") && !s.includes(".."))) return s;
  return fallback;
}
export function componentData({monster,part,rarity,quantity=1,weight=0.5,img,portrait,origin}) {
  assert(String(monster.name??"").trim() && String(part.name??"").trim(),"Informe o nome da criatura e do componente.");
  assert(RARITIES[rarity], "Escolha uma raridade válida para o componente.");
  assert(TYPES[monster.type] && CATEGORIES[part.category], "Informe o tipo de criatura e a categoria do componente.");
  assert(Number.isInteger(quantity) && quantity > 0 && quantity <= 999, "A quantidade deve ser um inteiro entre 1 e 999.");
  assert(Number.isFinite(weight) && weight >= 0, "Informe um peso válido em kg.");
  const name = `${part.name} (${monster.name}) | (${RARITIES[rarity]})`;
  const text = `<p><strong>TIPO DE ITEM:</strong> ${escapeHTML(CATEGORIES[part.category].toLocaleUpperCase("pt-BR"))}</p><p><strong>TIPO DE MONSTRO:</strong> ${escapeHTML(TYPES[monster.type].toLocaleUpperCase("pt-BR"))}</p>`;
  const sourceTraits=Object.fromEntries(["dealsLightning","shapechanger","coldImmune"].map(key=>[key,monster.sourceTraits?.[key]===true]));
  return {name,type:"loot",img:safeImage(img,"icons/svg/item-bag.svg"),system:{quantity,weight:{value:weight,units:"kg"},rarity,description:{value:`${text}<p><img src="${escapeHTML(safeImage(portrait))}" alt="${escapeHTML(monster.name.toLocaleUpperCase("pt-BR"))}" style="max-width:100%;max-height:320px;object-fit:contain"></p>`}},flags:{[ID]:{kind:"component",category:part.category,part:part.part,monster:monster.name,sourceMonsterName:monster.catalogName??monster.name,creatureType:monster.type,affinities:part.affinities ?? [monster.type],rarity,origin:origin || "",sourceMonsterId:monster.id ?? null,sourceTraits}}};
}

export function sourceTraitsFromActor(actor) {
  const values=collection=>collection?.values instanceof Function?[...collection.values()]:Object.values(collection??{});
  const hasType=(value,type)=>value instanceof Set?value.has(type):Array.isArray(value)?value.includes(type):value===type;
  const partsHaveLightning=parts=>values(parts).some(part=>hasType(part?.types,"lightning") || (Array.isArray(part)&&part[1]==="lightning"));
  const items=values(actor.items);
  return {
    coldImmune:hasType(actor.system?.traits?.di?.value,"cold"),
    shapechanger:items.some(item=>[normalize(item.name),normalize(item.system?.identifier)].some(name=>["shapechanger","metamorfo"].includes(name))),
    dealsLightning:items.some(item=>hasType(item.system?.damage?.base?.types,"lightning") || partsHaveLightning(item.system?.damage?.parts) || values(item.system?.activities).some(activity=>hasType(activity.damage?.base?.types,"lightning") || partsHaveLightning(activity.damage?.parts)))
  };
}

const partWords = ["Monster Blood","Contaminated Ichor","Chemical Solution","Elemental Fluids?","Goopy Ooze","Acidic Bile","Webbed Membrane","Natural Weapons?","Fiendish Dust","Fiend Dust","Aberrant Dust","Draconic Dust","Dragon Dust","Elemental Dust","Fey Dust","Plant Dust","Undead Dust","Celestial Dust","Animus","Bones?","Skulls?","Spine","Ribs","Dust","Fluid","Ectoplasm","Mucus","Venom","Sap","Hair","Fur","Feathers","Leaves","Stitches","Hide","Skin","Scales","Plates","Bark","Shell","Carapace","Organs?","Eyes?","Heart","Brain","Guts","Glands","Flesh","Flowers?","Claws","Teeth","Horns","Tentacles","Blades?","Needles","Spores","Mandibles"];
const newPart = new RegExp(`,\\s*(?=(?:(?:Any|Two)\\s+)*(?:(?:Very Rare|Uncommon|Common|Rare|Legendary)\\s+)?(?:${partWords.join("|")})(?:\\b))`,"i");
const genericParts = new Set(["animus","bone","dust","fluid","hair","hide","natural weapon","organ"]);
const singular = s => normalize(s).replace(/\b(skulls|bones|organs|eyes|flowers|blades|fluids|natural weapons)\b/g, m=>m.slice(0,-1)).replace(/fiendish/g,"fiend").replace(/draconic/g,"dragon").replace(/aberrant/g,"aberration");
const sourceTypes = {aberration:["aberration","aberrant"],beast:["beast"],celestial:["celestial"],construct:["construct"],dragon:["dragon","draconic"],elemental:["elemental"],fey:["fey"],fiend:["fiend","fiendish"],giant:["giant"],humanoid:["humanoid"],monstrosity:["monstrosity"],ooze:["ooze"],plant:["plant"],undead:["undead"]};
function parseAlternative(text, category) {
  const raw = text.trim();
  const special = /deals Lightning|Shapechanger|Immune to Cold/i.test(raw);
  const [partText,sourceText=""] = raw.split(/\s+(?:from|of)\s+/i,2);
  const prefix = partText.replace(/^(?:(?:any|two)\s+)+/i,"").replace(/^(?:very rare|uncommon|common|rare|legendary)\s+/i,"").trim();
  let part = singular(prefix);
  const affinities = category === "animus" ? Object.entries(sourceTypes).filter(([,words])=>words.some(w=>new RegExp(`\\b${w}\\b`,"i").test(partText))).map(([t])=>t) : [];
  if (category === "animus") part="animus";
  let source=sourceText.replace(/^(?:(?:any|two|different|an?)\s+)+/i,"").replace(/\(traditionally[^)]*\)/i,"").trim();
  // "Any Giant" in a category column means any component of that category from a giant.
  if (Object.keys(sourceTypes).includes(part)) {source=part;part="any";}
  return {part,source,affinities,manual:special || /different|two Trolls/i.test(sourceText),raw};
}
export function recipeSlots(recipe) {
  const slots=[];
  for (const requirement of recipe.requirements) {
    const sourceStart=requirement.raw.search(/\s+(?:from|of)\s+/i);
    const leading=sourceStart<0?requirement.raw:requirement.raw.slice(0,sourceStart);
    const chunks = /\bor\b/i.test(leading) ? [requirement.raw] : requirement.raw.split(newPart);
    for (const chunk of chunks) {
      const two = /\b(?:any )?two\b/i.test(chunk);
      const count = two ? 2 : 1;
      // "or" before a source qualifier belongs to the qualifier, not to the anatomical part.
      const sourceAt=chunk.search(/\s+(?:from|of)\s+/i);
      const leadingPart=sourceAt<0?chunk:chunk.slice(0,sourceAt);
      const suffix=sourceAt<0?"":chunk.slice(sourceAt);
      const alternatives = /\bor\b/i.test(leadingPart) ? leadingPart.split(/,\s*(?:or\s+)?|\s+or\s+/i).map(part=>part+suffix) : [chunk];
      for(let i=0;i<count;i++) slots.push({category:requirement.category,label:requirement.label,raw:chunk,distinct:two && /different|two Trolls/i.test(chunk),alternatives:alternatives.map(x=>parseAlternative(x,requirement.category))});
    }
  }
  return slots;
}
function sourceMatches(source, component, strictSpecial) {
  if (!source) return true;
  source=normalize(source);
  const sharedSuffix=/\b(dragon|giant|troll)\s*$/.exec(source)?.[1];
  const tokens=source.split(/,\s*(?:or\s+)?|\s+or\s+/).map(t=>t.replace(/^(?:any |an? )/i,"").trim()).filter(Boolean).map(t=>sharedSuffix && /^(?:blue|bronze|red|white|silver|fire|frost|winter)$/.test(t)?`${t} ${sharedSuffix}`:t);
  return tokens.some(token=>{
    const special=/deals lightning damage/.test(token)?"dealsLightning":/shapechanger trait/.test(token)?"shapechanger":/immune to cold damage/.test(token)?"coldImmune":null;
    if(special){
      const confirmed=component.sourceTraits?.[special];
      return confirmed===true || (!strictSpecial && confirmed===undefined);
    }
    const type=Object.entries(sourceTypes).find(([,words])=>words.includes(token.replace(/s$/,"")))?.[0];
    if(type) return component.creatureType===type;
    const monsterWords=new Set(normalize(component.sourceMonsterName??component.monster).match(/[a-z0-9]+/g)??[]);
    // Qualifiers such as "Blue Dragon" must never degrade to simply "dragon".
    const words=token.replace(/s$/i,"").match(/[a-z0-9]+/g)??[];
    const namedType=Object.keys(sourceTypes).find(type=>words.includes(type));
    return words.length>0 && (!namedType || component.creatureType===namedType) && words.every(word=>monsterWords.has(word));
  });
}
export function matchSlot(slot, item, rarity, {strictSpecial=false,allowHigherRarity=true}={}) {
  const c=item.flags?.[ID] ?? item.component;
  const quantity=Number(item.system?.quantity ?? item.quantity ?? 0);
  if (!c || !RARITIES[rarity] || !c.part || c.category !== slot.category || !(allowHigherRarity?workshopMeets(c.rarity,rarity):c.rarity===rarity) || !Number.isFinite(quantity) || quantity < 1) return false;
  return slot.alternatives.some(a=>{
    const actual=singular(c.part);
    const partOkay=genericParts.has(a.part) || a.part==="any" || actual===a.part || (a.part==="any dragon dust" && actual==="dragon dust");
    const affinityOkay=!a.affinities.length || a.affinities.some(t=>(c.affinities ?? [c.creatureType]).includes(t));
    return partOkay && affinityOkay && sourceMatches(a.source,c,strictSpecial);
  });
}
export function validateCombination(recipe,items,assignments,rarity) {
  assert(RARITIES[rarity],"A raridade desta fabricação precisa ser definida.");
  const slots=recipeSlots(recipe);
  assert(assignments.length===slots.length,"Preencha todos os componentes da receita.");
  const counts=new Map(),distinct=[];
  slots.forEach((slot,i)=>{
    const id=assignments[i];const item=items.find(x=>x.id===id);
    assert(item && matchSlot(slot,item,rarity),`Componente incompatível ou indisponível: ${slot.label}.`);
    counts.set(id,(counts.get(id)??0)+1);
    const c=item.flags[ID];
    if (slot.distinct || recipe.other) {
      assert(c.origin,"Registre a origem da coleta para conferir criaturas diferentes.");
      const group=recipe.other ? "all" : `${slot.category}:${slot.raw}`;
      assert(!distinct.some(d=>d.group===group && d.origin===c.origin),"Esta receita exige componentes de criaturas diferentes.");
      distinct.push({group,origin:c.origin});
    }
  });
  for (const [id,qty] of counts) assert(Number(items.find(x=>x.id===id).system.quantity)>=qty,"A quantidade de um componente é insuficiente.");
  return {counts:Object.fromEntries(counts),manual:slots.filter(s=>s.alternatives.some(a=>a.manual)).map(s=>s.label)};
}
export function canStudy(item,recipe) {
  const rarity=item.flags?.[ID]?.rarity;
  return recipeSlots(recipe).some(s=>matchSlot(s,item,recipe.rarity==="varies" ? rarity : recipe.rarity,{strictSpecial:true,allowHigherRarity:false}));
}
export function studyCandidates(item, allRecipes, knownIds=[]) {
  const known=new Set(knownIds),seen=new Set();
  return allRecipes.filter(recipe=>!known.has(recipe.id) && !seen.has(recipe.id) && canStudy(item,recipe) && seen.add(recipe.id));
}
function randomFraction() {
  return globalThis.crypto?.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]/2**32:Math.random();
}
function shuffled(values,random) {
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const at=Math.floor(random()*(i+1));[result[i],result[at]]=[result[at],result[i]];}
  return result;
}
export function drawStudyRecipes(items, allRecipes, knownIds=[], random=randomFraction) {
  // One entry per recipe, regardless of how many of its requirements accept the item.
  const candidates=new Map(items.map(item=>[item.id,shuffled(studyCandidates(item,allRecipes,knownIds).map(recipe=>recipe.id),random)]));
  const assigned=new Map();
  // Randomized maximum matching prevents an overlapping generic recipe from needlessly
  // blocking another selected component. Each discovered recipe is assigned only once.
  const assign=(itemId,visited)=>{
    for(const recipeId of candidates.get(itemId)){
      if(visited.has(recipeId))continue;visited.add(recipeId);
      const previous=assigned.get(recipeId);
      if(previous===undefined || assign(previous,visited)){assigned.set(recipeId,itemId);return true;}
    }
    return false;
  };
  for(const item of shuffled(items,random))assign(item.id,new Set());
  const results=new Map([...assigned].map(([recipeId,itemId])=>[itemId,{itemId,recipeId}]));
  return items.flatMap(item=>results.has(item.id)?[results.get(item.id)]:[]);
}
export function workshopMeets(workshop,required) {
  const keys=Object.keys(RARITIES);
  return keys.includes(workshop) && keys.includes(required) && keys.indexOf(workshop)>=keys.indexOf(required);
}
