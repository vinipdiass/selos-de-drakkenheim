import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {ID} from "../selos-de-drakkenheim/scripts/core.mjs";
const data=JSON.parse(fs.readFileSync(new URL("../selos-de-drakkenheim/data/catalog.json",import.meta.url)));
globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(data)});
const catalog=await import("../selos-de-drakkenheim/scripts/catalog.mjs");await catalog.loadCatalog();
const {setRecipeImage}=await import("../selos-de-drakkenheim/scripts/service.mjs");
const potion=data.recipes.find(row=>row.originalName==="Potion of Healing"),other=data.recipes.find(row=>row.id!==potion.id&&row.category===potion.category);
let settings,updates;
function reset(){
  settings={recipeImages:{},recipeResults:{},customRecipes:[]};updates=[];
  globalThis.game={user:{isGM:true},settings:{get(_scope,key){return structuredClone(settings[key])},async set(scope,key,value){assert.equal(scope,ID);settings[key]=structuredClone(value)}}};
  globalThis.Hooks={callAll:(...args)=>updates.push(args)};
}
test("ícone global é resolvido pela receita para todos os personagens e futuros aprendizados",async()=>{
  reset();const a={recipes:[{id:potion.id}]},b={recipes:[{id:potion.id}]},before=structuredClone([a,b]);
  await setRecipeImage(potion.id,"icons/potion.webp");
  for(const actor of [a,b])assert.equal(catalog.getRecipe(actor.recipes[0].id).img,"icons/potion.webp");
  assert.equal(catalog.getRecipe(potion.id).img,"icons/potion.webp");assert.deepEqual([a,b],before);assert.ok(updates.some(([hook])=>hook===`${ID}.updated`));
});
test("alterar uma poção não altera outra receita da mesma categoria nem o vínculo do resultado",async()=>{
  reset();settings.recipeResults[potion.id]={resultUuid:"Item.result"};await setRecipeImage(other.id,"icons/other.webp");await setRecipeImage(potion.id,"icons/healing.webp");
  assert.equal(catalog.getRecipe(potion.id).img,"icons/healing.webp");assert.equal(catalog.getRecipe(other.id).img,"icons/other.webp");assert.equal(catalog.getRecipe(potion.id).resultUuid,"Item.result");
});
test("jogador não pode mudar ou restaurar o ícone global",async()=>{
  reset();await setRecipeImage(potion.id,"icons/potion.webp");game.user.isGM=false;
  for(const value of ["icons/other.webp",""])await assert.rejects(setRecipeImage(potion.id,value),/Somente o mestre/);
  assert.equal(catalog.getRecipe(potion.id).img,"icons/potion.webp");
});
test("restaurar padrão remove só a imagem daquela receita",async()=>{
  reset();await setRecipeImage(potion.id,"icons/potion.webp");await setRecipeImage(other.id,"icons/other.webp");await setRecipeImage(potion.id,"");
  assert.equal(catalog.getRecipe(potion.id).img,"");assert.equal(catalog.getRecipe(other.id).img,"icons/other.webp");assert.equal(Object.hasOwn(settings.recipeImages,potion.id),false);
});
test("caminhos inválidos e protocolos executáveis são rejeitados sem alterar configurações",async()=>{
  reset();for(const value of ["javascript:alert(1)","data:image/svg+xml,bad","../private/icon.webp",'icons/<img>.webp',"x".repeat(2049),{},null])await assert.rejects(setRecipeImage(potion.id,value),/imagem|URL/);
  assert.deepEqual(settings.recipeImages,{});
});
test("salva URL de imagem com parâmetros e remove espaços externos",async()=>{
  reset();const url="https://example.com/potion.webp?v=2";assert.equal(await setRecipeImage(potion.id,`  ${url}  `),url);assert.equal(catalog.getRecipe(potion.id).img,url);
});
test("receita inexistente não recebe configuração",async()=>{
  reset();await assert.rejects(setRecipeImage("missing","icons/test.webp"),/não encontrada/);assert.deepEqual(settings.recipeImages,{});
});
test("receita personalizada recebe ícone global pela própria identidade",async()=>{
  reset();settings.customRecipes=[{...potion,id:"custom-123",name:potion.name}];await setRecipeImage("custom-123","icons/custom.webp");assert.equal(catalog.getRecipe("custom-123").img,"icons/custom.webp");assert.equal(catalog.getRecipe(potion.id).img,"");
});
test("alterações simultâneas em receitas diferentes preservam as duas imagens",async()=>{
  reset();await Promise.all([setRecipeImage(potion.id,"icons/potion.webp"),setRecipeImage(other.id,"icons/other.webp")]);assert.equal(catalog.getRecipe(potion.id).img,"icons/potion.webp");assert.equal(catalog.getRecipe(other.id).img,"icons/other.webp");
});
test("falha ao salvar não anuncia nem altera o ícone anterior",async()=>{
  reset();await setRecipeImage(potion.id,"icons/potion.webp");updates=[];game.settings.set=async()=>{throw new Error("Sem conexão")};await assert.rejects(setRecipeImage(potion.id,"icons/other.webp"),/Sem conexão/);assert.equal(catalog.getRecipe(potion.id).img,"icons/potion.webp");assert.deepEqual(updates,[]);
});
