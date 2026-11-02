import {assert} from "./core.mjs";
import {selectedResult} from "./bindings.mjs";

const types={weapon:"Arma",equipment:"Equipamento",consumable:"Consumível",tool:"Ferramenta",loot:"Tesouro",container:"Contêiner"};
const editor=()=>foundry.applications.ux.TextEditor.implementation;

export async function publicDescription(html,{relativeTo,documents=false,links=false}={}){
  // Strip unrevealed secrets before sharing with players. Never expand embeds as the GM.
  const text=await editor().enrichHTML(String(html??""),{secrets:false,documents,links,embeds:false,rolls:false,custom:false,relativeTo});
  return foundry.utils.cleanHTML(text);
}

export async function itemPreview(item){
  const system=item.system??{},identified=system.identified!==false,details=[{label:"Tipo",value:types[item.type]??item.type}];
  if(Number.isFinite(system.weight?.value))details.push({label:"Peso",value:`${system.weight.value} ${system.weight.units??""}`.trim()});
  if(identified&&Number.isFinite(system.price?.value))details.push({label:"Preço",value:`${system.price.value} ${system.price.denomination??""}`.trim()});
  const properties=Array.from(system.properties??[]).map(key=>{
    const property=globalThis.CONFIG?.DND5E?.itemProperties?.[key],label=property?.label??property??key;
    return typeof label==="string"?(game.i18n?.localize(label)??label):key;
  });
  if(identified&&properties.length)details.push({label:"Propriedades",value:properties.join(", ")});
  // Only public fields are persisted, never the full document or its GM notes/flags.
  return {version:1,description:await publicDescription(identified?system.description?.value:system.unidentified?.description),details};
}

export async function resultPreview(recipe,rarity,uuid){
  const result=selectedResult(recipe,rarity,uuid);
  assert(result,"Este item não está mais vinculado à receita nesta raridade.");
  let source;
  try{
    const item=await fromUuid(result.uuid);
    if(item?.documentName==="Item"&&(game.user.isGM||item.testUserPermission?.(game.user,"OBSERVER")))source=item;
  }catch{/* A restricted compendium may be inaccessible to the player. */}
  const preview=source?await itemPreview(source):result.preview;
  return {result,source,preview,description:await publicDescription(preview?.description,{relativeTo:source,documents:true,links:true})};
}
