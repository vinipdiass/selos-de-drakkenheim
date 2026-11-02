import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const data=JSON.parse(fs.readFileSync(new URL('../selos-de-drakkenheim/data/catalog.json',import.meta.url)));
globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(data)});
const catalog=await import('../selos-de-drakkenheim/scripts/catalog.mjs');await catalog.loadCatalog();
const links=await import('../selos-de-drakkenheim/scripts/result-links.mjs');
const {resultChoices,selectedResult}=await import('../selos-de-drakkenheim/scripts/bindings.mjs');
const potion=data.recipes.find(r=>r.originalName==='Potion of Healing'),variable=data.recipes.find(r=>r.rarity==='varies');
let settings,docs;
function reset(){
  settings={recipeResults:{},customRecipes:[],recipeImages:{[potion.id]:'old-image.webp'}};
  docs=new Map(['a','b','c'].map(id=>[`Item.${id}`,{uuid:`Item.${id}`,documentName:'Item',type:'weapon',name:`Item ${id}`,img:`icons/${id}.webp`,system:{rarity:'rare'}}]));
  const gm={id:'gm',isGM:true,active:true};globalThis.game={user:gm,users:{activeGM:gm},settings:{get(_scope,key){return structuredClone(settings[key])},async set(_scope,key,value){settings[key]=structuredClone(value)}}};
  globalThis.fromUuid=async uuid=>docs.get(uuid);globalThis.Hooks={callAll(){}};
}
test('vínculo global usa imagem e nome do item para qualquer personagem',async()=>{reset();await links.linkRecipeItem(potion.id,'Item.a');const recipe=catalog.getRecipe(potion.id);assert.equal(recipe.img,'icons/a.webp');assert.equal(resultChoices(recipe,'common')[0].name,'Item a');assert.equal(selectedResult(recipe,'common').uuid,'Item.a')});
test('sem vínculo não usa o antigo ícone personalizado',()=>{reset();assert.equal(catalog.getRecipe(potion.id).img,'');assert.equal(resultChoices(catalog.getRecipe(potion.id),'common').length,0)});
test('várias opções em cada raridade são independentes',async()=>{reset();await links.linkRecipeItem(variable.id,'Item.a','common');await links.linkRecipeItem(variable.id,'Item.b','common');await links.linkRecipeItem(variable.id,'Item.c','rare');const recipe=catalog.getRecipe(variable.id);assert.equal(resultChoices(recipe,'common').length,2);assert.equal(resultChoices(recipe,'rare').length,1);assert.equal(resultChoices(recipe,'legendary').length,0);assert.equal(selectedResult(recipe,'common'),undefined);assert.equal(selectedResult(recipe,'common','Item.b').uuid,'Item.b')});
test('jogador não altera vínculos',async()=>{reset();game.user={isGM:false};await assert.rejects(links.linkRecipeItem(potion.id,'Item.a'),/Somente o mestre/);await assert.rejects(links.unlinkRecipeItem(potion.id,'common','Item.a'),/Somente o mestre/)});
test('desvincular não afeta outra raridade e não recria vínculo antigo',async()=>{reset();settings.recipeResults[variable.id]={resultUuid:'Item.a'};await links.linkRecipeItem(variable.id,'Item.b','rare');await links.unlinkRecipeItem(variable.id,'common','Item.a');assert.equal(resultChoices(catalog.getRecipe(variable.id),'common').length,0);assert.equal(resultChoices(catalog.getRecipe(variable.id),'rare').length,1)});
test('duplicar o mesmo item na mesma raridade atualiza a imagem sem duplicar opção',async()=>{reset();await links.linkRecipeItem(potion.id,'Item.a');docs.get('Item.a').img='icons/updated.webp';await links.linkRecipeItem(potion.id,'Item.a');assert.equal(resultChoices(catalog.getRecipe(potion.id),'common').length,1);assert.equal(catalog.getRecipe(potion.id).img,'icons/updated.webp')});
test('vínculos inválidos não são salvos',async()=>{reset();docs.set('Journal.bad',{documentName:'JournalEntry',type:'base'});for(const uuid of ['Item.missing','Journal.bad'])await assert.rejects(links.linkRecipeItem(potion.id,uuid),/físico/);await assert.rejects(links.linkRecipeItem(variable.id,'Item.a','invalid'),/raridade/);assert.deepEqual(settings.recipeResults,{})});
test('migração preserva vínculos legados e usa a raridade do item em receitas variáveis',async()=>{reset();settings.recipeResults={[potion.id]:{resultUuid:'Item.a'},[variable.id]:{resultUuid:'Item.b'}};await links.migrateResultLinks();assert.equal(catalog.getRecipe(potion.id).img,'icons/a.webp');assert.equal(resultChoices(catalog.getRecipe(variable.id),'rare')[0].uuid,'Item.b');assert.equal(resultChoices(catalog.getRecipe(variable.id),'common').length,0)});
