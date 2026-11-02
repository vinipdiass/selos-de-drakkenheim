import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {ID,componentData} from "../selos-de-drakkenheim/scripts/core.mjs";

const data=JSON.parse(fs.readFileSync(new URL("../selos-de-drakkenheim/data/catalog.json",import.meta.url)));
const recipe=data.recipes.find(row=>row.originalName==="Potion of Healing");
class Collection extends Map{filter(fn){return [...this.values()].filter(fn)}find(fn){return [...this.values()].find(fn)}}
class DelayedApplication{
  constructor(){this.rendered=false;this.frontCalls=0;this.renderOptions=[];}
  async render(options){
    this.renderOptions.push(options);
    await (this.renderBlock??Promise.resolve());
    if(this.closed)return this;
    if(this.failRender)throw new Error("Falha na criação da janela");
    this.element??={style:{}};this.rendered=true;return this;
  }
  bringToFront(){this.element.style.zIndex=String(++this.frontCalls);}
  async close(){this.rendered=false;await this._onClose({});this.element=undefined;}
  async _onClose(){}
}
globalThis.foundry={applications:{api:{ApplicationV2:DelayedApplication}}};
globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(data)});
const catalog=await import("../selos-de-drakkenheim/scripts/catalog.mjs");await catalog.loadCatalog();
const playerUI=await import("../selos-de-drakkenheim/scripts/player-ui.mjs");
let actor,token,errors;
function reset(){
  errors=[];
  const flags={recipes:[{id:recipe.id}],study:{restId:"rest",limit:2,used:[]}};
  const item={...componentData({monster:{name:"Ratling",type:"monstrosity"},part:{category:"animus",part:"Animus",name:"Ânima"},rarity:"common"}),id:"material",getFlag(_scope,key){return this.flags[ID][key]}};
  actor={id:"hero",uuid:"Actor.hero",type:"character",items:new Collection([[item.id,item]]),getFlag(_scope,key){return flags[key]},testUserPermission(){return true}};
  const npc={id:"npc",name:"Ratling Warrior",type:"npc",system:{details:{type:{value:"monstrosity"},cr:.125},attributes:{hp:{value:0}}},items:[],getFlag(){}};
  token={documentName:"Token",uuid:"Scene.scene.Token.corpse",actorId:npc.id,actor:npc,disposition:-1,getFlag(){}};
  globalThis.game={user:{id:"player",isGM:false,character:actor},actors:new Collection([[actor.id,actor],[npc.id,npc]]),settings:{get(_scope,key){return {recipeResults:{},customRecipes:[],requests:[]}[key]}}};
  globalThis.ui={notifications:{error:message=>errors.push(message),warn:message=>errors.push(message),info:message=>errors.push(message)}};
}
const openers={
  grimório:()=>playerUI.openPlayerBook(actor),
  bancada:()=>playerUI.openForge(actor,recipe),
  estudo:()=>playerUI.openPlayerStudy(actor),
  coleta:()=>playerUI.openLoot(token)
};
for(const [name,open]of Object.entries(openers))test(`${name} aguarda a renderização e reutiliza a janela quando aberto rapidamente duas vezes`,async()=>{
  reset();let release;const panel=open();panel.renderBlock=new Promise(resolve=>release=resolve);
  assert.equal(panel.element,undefined);assert.equal(panel.frontCalls,0);assert.equal(open(),panel);
  await Promise.resolve();assert.equal(panel.frontCalls,0);release();await panel.drawing;
  assert.equal(panel.rendered,true);assert.equal(panel.frontCalls,2);assert.equal(panel.renderOptions[0].force,true);assert.equal(panel.renderOptions[1].force,false);assert.deepEqual(errors,[]);
  await panel.close();
});
test("atualizar inventário não traz o grimório para frente",async()=>{
  reset();const panel=openers.grimório();await panel.drawing;const initial=panel.frontCalls;
  await playerUI.refreshPlayerPanels(actor);assert.equal(panel.frontCalls,initial);assert.equal(panel.renderOptions.at(-1).force,false);assert.deepEqual(errors,[]);await panel.close();
});
test("janela fechada durante a renderização não recebe foco depois",async()=>{
  reset();let release;const panel=openers.bancada();panel.renderBlock=new Promise(resolve=>release=resolve);
  await Promise.resolve();await panel.close();release();await panel.drawing;assert.equal(panel.frontCalls,0);assert.equal(panel.element,undefined);assert.deepEqual(errors,[]);
});
test("falha de renderização é informada sem tentar acessar o estilo de um elemento ausente",async()=>{
  reset();const panel=openers.estudo();panel.failRender=true;await panel.drawing;
  assert.equal(panel.frontCalls,0);assert.deepEqual(errors,["Falha na criação da janela"]);await panel.close();
});
