import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const data=JSON.parse(fs.readFileSync(new URL('../selos-de-drakkenheim/data/catalog.json',import.meta.url)));
globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(data)});
const catalog=await import('../selos-de-drakkenheim/scripts/catalog.mjs');await catalog.loadCatalog();
const links=await import('../selos-de-drakkenheim/scripts/result-links.mjs');
const {resultChoices,selectedResult}=await import('../selos-de-drakkenheim/scripts/bindings.mjs');
const {resultPreview}=await import('../selos-de-drakkenheim/scripts/result-preview.mjs');
const potion=data.recipes.find(r=>r.originalName==='Potion of Healing'),variable=data.recipes.find(r=>r.rarity==='varies');
let settings,docs;
function reset(){
  settings={recipeResults:{},customRecipes:[],recipeImages:{[potion.id]:'old-image.webp'}};
  docs=new Map(['a','b','c'].map(id=>[`Item.${id}`,{uuid:`Item.${id}`,documentName:'Item',type:'weapon',name:`Item ${id}`,img:`icons/${id}.webp`,system:{rarity:'rare'}}]));
  globalThis.foundry={applications:{ux:{TextEditor:{implementation:{async enrichHTML(content,options){assert.equal(options.secrets,false);assert.equal(options.embeds,false);assert.equal(options.custom,false);return content.replace(/<section class="secret">.*?<\/section>/gs,'')}}}}},utils:{cleanHTML:html=>html.replace(/<script>.*?<\/script>/gs,'')}};
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
test('descrição pública fica disponível mesmo sem acesso ao item original, sem notas privadas ou segredos',async()=>{
  reset();const item=docs.get('Item.a');Object.assign(item.system,{description:{value:'<p>Cura <strong>2d4+2</strong>.</p><section class="secret">SEGREDO</section><script>bad()</script>',chat:'NOTA PRIVADA'},weight:{value:.5,units:'lb'},price:{value:50,denomination:'gp'}});item.flags={gmNote:'NOTA PRIVADA'};
  await links.linkRecipeItem(potion.id,'Item.a');const saved=JSON.stringify(settings.recipeResults);assert.ok(!saved.includes('SEGREDO'));assert.ok(!saved.includes('NOTA PRIVADA'));assert.ok(!saved.includes('bad()'));
  game.user={isGM:false};globalThis.fromUuid=async()=>{throw new Error('Compêndio privado')};
  const preview=await resultPreview(catalog.getRecipe(potion.id),'common','Item.a');assert.equal(preview.source,undefined);assert.equal(preview.description,'<p>Cura <strong>2d4+2</strong>.</p>');assert.deepEqual(preview.preview.details,[{label:'Tipo',value:'Arma'},{label:'Peso',value:'0.5 lb'},{label:'Preço',value:'50 gp'}]);
});
test('prévia respeita resultado e raridade, e deixa de abrir depois de desvincular',async()=>{
  reset();docs.get('Item.a').system.description={value:'Resultado comum'};docs.get('Item.b').system.description={value:'Resultado raro'};await links.linkRecipeItem(variable.id,'Item.a','common');await links.linkRecipeItem(variable.id,'Item.b','rare');
  game.user={isGM:false};assert.equal((await resultPreview(catalog.getRecipe(variable.id),'rare','Item.b')).description,'Resultado raro');await assert.rejects(resultPreview(catalog.getRecipe(variable.id),'common','Item.b'),/vinculado/);
  game.user.isGM=true;await links.unlinkRecipeItem(variable.id,'rare','Item.b');await assert.rejects(resultPreview(catalog.getRecipe(variable.id),'rare','Item.b'),/vinculado/);
});
test('prévia usa descrição atual quando o jogador tem permissão de observador',async()=>{
  reset();await links.linkRecipeItem(potion.id,'Item.a');const item=docs.get('Item.a');item.system.description={value:'Atualizada'};item.testUserPermission=(_user,level)=>level==='OBSERVER';game.user={isGM:false};const preview=await resultPreview(catalog.getRecipe(potion.id),'common','Item.a');assert.equal(preview.source,item);assert.equal(preview.description,'Atualizada');
});
test('atualização prepara descrições dos vínculos existentes uma vez, preservando resultados e raridades',async()=>{
  reset();settings.recipeResults[variable.id]={bindings:{common:[{uuid:'Item.a',name:'A',img:'a.webp'}],rare:[{uuid:'Item.b',name:'B',img:'b.webp'}]}};docs.get('Item.a').system.description={value:'Item existente'};
  await links.migrateResultLinks();const recipe=catalog.getRecipe(variable.id);assert.equal(resultChoices(recipe,'common')[0].preview.description,'Item existente');assert.equal(resultChoices(recipe,'rare')[0].uuid,'Item.b');const saved=structuredClone(settings.recipeResults);await links.migrateResultLinks();assert.deepEqual(settings.recipeResults,saved);
});
test('item não identificado compartilha apenas sua descrição não identificada',async()=>{
  reset();Object.assign(docs.get('Item.a').system,{identified:false,description:{value:'Efeito oculto'},unidentified:{description:'Um frasco misterioso'},price:{value:100,denomination:'gp'},properties:new Set(['mgc'])});await links.linkRecipeItem(potion.id,'Item.a');game.user={isGM:false};const preview=await resultPreview(catalog.getRecipe(potion.id),'common','Item.a');assert.equal(preview.description,'Um frasco misterioso');assert.deepEqual(preview.preview.details,[{label:'Tipo',value:'Arma'}]);assert.ok(!JSON.stringify(settings.recipeResults).includes('Efeito oculto'));
});
