import {ID,CATEGORIES,TYPES,RARITIES,normalize,assert} from "./core.mjs";

const labels={Animus:["animus","Ânima"],"Monster Blood":["fluid","Sangue de monstro"],"Elemental Fluid":["fluid","Fluido elemental"],"Goopy Ooze":["fluid","Gosma"],Ectoplasm:["fluid","Ectoplasma"],Sap:["fluid","Seiva"],Venom:["fluid","Veneno"],"Draconic Dust":["dust","Pó dracônico"],"Elemental Dust":["dust","Pó elemental"],"Aberrant Dust":["dust","Pó aberrante"],"Fey Dust":["dust","Pó feérico"],"Fiend Dust":["dust","Pó ínfero"],"Celestial Dust":["dust","Pó celestial"],"Undead Dust":["dust","Pó de morto-vivo"],"Plant Dust":["dust","Pó vegetal"],Skull:["bones","Crânio"],Spine:["bones","Coluna vertebral"],Ribs:["bones","Costelas"],Heart:["organs","Coração"],Eyes:["organs","Olhos"],Flesh:["organs","Carne"],Skin:["hide","Pele"],Scales:["hide","Escamas"],Plates:["hide","Placas"],Bark:["hide","Casca"],Leaves:["hair","Folhas"],Fur:["hair","Pelagem"],Feathers:["hair","Penas"],Claws:["natural","Garras"],Teeth:["natural","Dentes"],Horns:["natural","Chifres"],Tentacles:["natural","Tentáculos"]};
const values=collection=>collection?.values instanceof Function?[...collection.values()]:Object.values(collection??{});
export function inferredCreatureType(actor){
  const raw=actor.system?.details?.type?.value??actor.system?.details?.type;
  if(TYPES[raw])return raw;
  const custom=normalize(actor.system?.details?.type?.custom??raw);
  const translated=Object.entries(TYPES).find(([key,label])=>normalize(key)===custom||normalize(label)===custom);
  if(translated)return translated[0];
  const name=normalize(`${actor.name} ${typeof raw==="string"?raw:""}`);
  if(/\bmephit\b/.test(name))return "elemental";
  if(/\b(dragon|dragao)\b/.test(name))return "dragon";
  if(/\b(golem|construct|constructo)\b/.test(name))return "construct";
  return "monstrosity";
}
export function inferHarvestParts(actor,type=inferredCreatureType(actor)){
  const name=normalize(`${actor.name} ${actor.system?.details?.type?.subtype??""}`),features=normalize(values(actor.items).map(item=>`${item.name??""} ${item.system?.identifier??""}`).join(" "));
  const incorporeal=/\b(ghost|specter|spectre|wraith|banshee|fantasma|incorporeal|incorporeo)\b/.test(`${name} ${features}`),parts=[];
  const add=part=>{if(parts.some(row=>row.part===part))return;const [category,label]=labels[part];parts.push({category,part,name:label,affinities:[type]});};
  add("Animus");
  const dust={dragon:"Draconic Dust",elemental:"Elemental Dust",aberration:"Aberrant Dust",fey:"Fey Dust",fiend:"Fiend Dust",celestial:"Celestial Dust",undead:"Undead Dust",plant:"Plant Dust"}[type];
  if(dust)add(dust);
  if(type==="construct")add("Plates");
  else if(type==="elemental"){
    if(/\b(water|agua|steam|vapor|ice|gelo|mud|lama)\b/.test(name))add("Elemental Fluid");
  }else if(type==="plant"){add("Sap");add("Bark");add("Leaves");}
  else if(type==="ooze")add("Goopy Ooze");
  else if(incorporeal)add("Ectoplasm");
  else{
    if(type!=="undead")add("Monster Blood");
    for(const part of ["Skull","Spine","Ribs","Flesh"])add(part);
    if(type!=="undead")for(const part of ["Heart","Eyes"])add(part);
    add(type==="dragon"?"Scales":"Skin");
    if(/\b(rat|ratling|wolf|bear|cat|lobo|urso|gato|fur|pelagem)\b/.test(`${name} ${features}`))add("Fur");
    if(/\b(bird|eagle|owl|griffon|ave|aguia|coruja|feathers|penas)\b/.test(name))add("Feathers");
  }
  if(!incorporeal){
    for(const [pattern,part]of [[/\b(claws?|talons?|garras?)\b/,"Claws"],[/\b(bite|teeth|mordida|dentes?)\b/,"Teeth"],[/\b(gore|horns?|chifrada|chifres?)\b/,"Horns"],[/\b(tentacles?|tentaculos?)\b/,"Tentacles"]])if(pattern.test(features))add(part);
    if(/\b(venom|veneno)\b/.test(features)&&type!=="construct")add("Venom");
  }
  return parts;
}
export function cleanHarvestConfig(config){
  assert(config&&["auto","custom"].includes(config.mode),"Configuração de coleta inválida.");
  if(config.mode==="auto")return {mode:"auto"};
  assert(Array.isArray(config.parts)&&config.parts.length<=100,"Cadastre no máximo 100 componentes.");
  const keys=new Set(),parts=config.parts.map(part=>{
    assert(CATEGORIES[part.category]&&typeof part.part==="string"&&part.part.trim().length>0&&part.part.length<=100&&typeof part.name==="string"&&part.name.trim().length>0&&part.name.length<=100,"Informe categoria e nomes válidos para cada componente.");
    const key=`${part.category}:${normalize(part.part)}`;assert(!keys.has(key),"Há componentes duplicados na lista.");keys.add(key);
    return {category:part.category,part:part.part.trim(),name:part.name.trim(),affinities:(part.affinities??[]).filter(value=>TYPES[value])};
  });
  assert(!config.rarity||RARITIES[config.rarity],"Raridade da coleta inválida.");
  return {mode:"custom",parts,rarity:config.rarity||"",monsterId:String(config.monsterId??"")};
}
export function harvestConfigFor(token){
  return token.getFlag?.(ID,"harvestConfig")??token.flags?.[ID]?.harvestConfig??token.actor?.prototypeToken?.flags?.[ID]?.harvestConfig;
}
