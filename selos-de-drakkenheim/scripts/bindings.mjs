import {RARITIES} from "./core.mjs";

export const PHYSICAL_ITEMS=new Set(["weapon","equipment","consumable","tool","loot","container"]);
export function resultChoices(recipe,rarity){
  if(!recipe||!RARITIES[rarity]||(recipe.rarity!=="varies"&&recipe.rarity!==rarity))return [];
  return (recipe.bindings?.[rarity]??[]).filter(entry=>typeof entry?.uuid==="string"&&entry.uuid);
}
export function allResults(recipe){return Object.keys(RARITIES).flatMap(rarity=>resultChoices(recipe,rarity));}
export function selectedResult(recipe,rarity,uuid){
  const choices=resultChoices(recipe,rarity);
  return uuid?choices.find(entry=>entry.uuid===uuid):(choices.length===1?choices[0]:undefined);
}
