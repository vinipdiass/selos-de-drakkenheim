import {ID,RARITIES,assert,safeImage} from "./core.mjs";
import {getRecipe,recipes} from "./catalog.mjs";
import {PHYSICAL_ITEMS} from "./bindings.mjs";
import {serialize,isAuthority} from "./service.mjs";

function metadata(item,uuid){return {uuid,name:item.name,img:safeImage(item.img,"icons/svg/item-bag.svg")};}
export function linkRecipeItem(recipeId,uuid,rarity){
  return serialize(async()=>{
    assert(game.user.isGM,"Somente o mestre pode vincular itens às receitas.");
    const recipe=getRecipe(recipeId);assert(recipe,"Receita não encontrada.");
    const tier=recipe.rarity==="varies"?rarity:recipe.rarity;
    assert(RARITIES[tier],"Selecione a raridade do resultado.");
    assert(typeof uuid==="string"&&uuid.trim(),"Informe ou arraste um item de resultado.");
    const item=await fromUuid(uuid.trim());
    assert(item?.documentName==="Item"&&PHYSICAL_ITEMS.has(item.type),"Vincule um item físico acessível do mundo, inventário ou compêndio.");
    const changes=structuredClone(game.settings.get(ID,"recipeResults")),entry={...(changes[recipeId]??{}),bindings:structuredClone(recipe.bindings)};
    const value=metadata(item,item.uuid??uuid.trim());
    entry.bindings[tier]=[...(entry.bindings[tier]??[]).filter(row=>row.uuid!==value.uuid),value];delete entry.resultUuid;
    changes[recipeId]=entry;await game.settings.set(ID,"recipeResults",changes);Hooks.callAll(`${ID}.updated`);return value;
  });
}
export function unlinkRecipeItem(recipeId,rarity,uuid){
  return serialize(async()=>{
    assert(game.user.isGM,"Somente o mestre pode remover vínculos de receitas.");
    const recipe=getRecipe(recipeId);assert(recipe&&RARITIES[rarity],"Receita ou raridade indisponível.");
    const changes=structuredClone(game.settings.get(ID,"recipeResults")),entry={...(changes[recipeId]??{}),bindings:structuredClone(recipe.bindings)};
    entry.bindings[rarity]=(entry.bindings[rarity]??[]).filter(row=>row.uuid!==uuid);delete entry.resultUuid;
    changes[recipeId]=entry;await game.settings.set(ID,"recipeResults",changes);Hooks.callAll(`${ID}.updated`);
  });
}
export async function migrateResultLinks(){
  if(!isAuthority())return;
  const changes=structuredClone(game.settings.get(ID,"recipeResults"));let changed=false;
  for(const recipe of recipes()){
    const previous=changes[recipe.id]??{},uuid=previous.resultUuid??recipe.resultUuid;
    if(previous.bindings||!uuid)continue;
    try{
      const item=await fromUuid(uuid);if(item?.documentName!=="Item"||!PHYSICAL_ITEMS.has(item.type))continue;
      const tier=recipe.rarity==="varies"?(RARITIES[item.system.rarity]?item.system.rarity:"common"):recipe.rarity;
      const entry={...previous,bindings:{[tier]:[metadata(item,item.uuid??uuid)]}};delete entry.resultUuid;changes[recipe.id]=entry;changed=true;
    }catch(error){console.warn(`${ID} | Vínculo antigo indisponível`,error.message);}
  }
  if(changed){await game.settings.set(ID,"recipeResults",changes);Hooks.callAll(`${ID}.updated`);}
}
