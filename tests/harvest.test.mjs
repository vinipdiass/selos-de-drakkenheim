import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {ID,CATEGORIES,canStudy,HARVEST_TOOLS_NAME,harvestTools} from "../selos-de-drakkenheim/scripts/core.mjs";
const data=JSON.parse(fs.readFileSync(new URL("../selos-de-drakkenheim/data/catalog.json",import.meta.url)));
globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(data)});
const catalog=await import("../selos-de-drakkenheim/scripts/catalog.mjs");await catalog.loadCatalog();
const harvest=await import("../selos-de-drakkenheim/scripts/harvest.mjs");
class Collection extends Map{filter(fn){return[...this.values()].filter(fn)}find(fn){return[...this.values()].find(fn)}get contents(){return[...this.values()]}}
let gm,player,hero,npc,token,documents,counter,settings,tools;
const componentsOf=actor=>actor.items.filter(item=>item.getFlag(ID,"kind")==="component");
const clone=structuredClone;
function tokenDocument(id="corpse"){
  const doc={id,uuid:`Scene.scene.Token.${id}`,documentName:"Token",actor:npc,actorId:npc.id,name:"Ratling Warrior #1",disposition:-1,hidden:false,parent:{id:"scene"},flags:{},getFlag(_scope,key){return clone(this.flags[key])},async setFlag(_scope,key,value){this.flags[key]=clone(value)}};
  documents.set(doc.uuid,doc);return doc;
}
function reset(){
  counter=0;settings={componentImages:Object.fromEntries(Object.keys(CATEGORIES).map(key=>[key,"icons/svg/item-bag.svg"])),wikiImageCache:{}};
  gm={id:"gm",isGM:true,active:true,viewedScene:"scene"};player={id:"player",isGM:false,active:true,viewedScene:"scene"};
  const users=new Collection([[gm.id,gm],[player.id,player]]);users.activeGM=gm;
  documents=new Map();
  hero={id:"hero",uuid:"Actor.hero",documentName:"Actor",type:"character",name:"Mirela",items:new Collection(),testUserPermission(user){return user?.id===player.id || user?.isGM},async createEmbeddedDocuments(_type,sources){if(this.failCreate){this.failCreate=false;throw new Error("Inventário indisponível")};const items=sources.map(source=>{const item={...clone(source),id:source._id,getFlag(_scope,key){return this.flags[ID][key]}};this.items.set(item.id,item);return item});if(this.failAfterCreate){this.failAfterCreate=false;throw new Error("Resposta perdida")};return items}};
  tools={id:"harvesting-tools",name:HARVEST_TOOLS_NAME,type:"container",system:{quantity:1},getFlag(){}};hero.items.set(tools.id,tools);
  npc={id:"npc",uuid:"Actor.npc",documentName:"Actor",type:"npc",name:"Ratling Warrior",system:{attributes:{hp:{value:0}},details:{cr:.125,type:{value:"monstrosity"}}},items:[],flags:{},getFlag(_scope,key){return this.flags[key]},testUserPermission(){return false}};
  documents.set(hero.uuid,hero);documents.set(npc.uuid,npc);token=tokenDocument();player.character=hero;
  globalThis.game={user:gm,users,actors:new Collection([[hero.id,hero],[npc.id,npc]]),settings:{get(_scope,key){return clone(settings[key])}},messages:new Collection()};
  globalThis.foundry={utils:{randomID(){return String(++counter).padStart(16,"A")}}};
  globalThis.fromUuid=async uuid=>documents.get(uuid);
}
function message({source=token,destination=hero,author=player,key="natural:claws",extra={}}={}){
  const request={id:foundry.utils.randomID(),tokenUuid:source.uuid,actorUuid:destination.uuid,partKey:key,...extra};
  const result={id:`chat-${request.id}`,author,flags:{kind:"harvest-request",harvestRequest:request},getFlag(_scope,key){return clone(this.flags[key])},async update(changes){if(this.failPublish){this.failPublish=false;throw new Error("Chat temporariamente indisponível")};for(const [key,value]of Object.entries(changes)){if(key.startsWith("flags."))this.flags[key.split(".").at(-1)]=clone(value);else this[key]=value}}};
  game.messages.set(result.id,result);return result;
}
const result=msg=>msg.getFlag(ID,"harvestResult");
test("coleta automática aceita apenas NPC hostil com exatamente zero PV",()=>{reset();assert.equal(harvest.isDefeatedEnemy(token),true);for(const hp of [1,-1,null,undefined,"",NaN]){npc.system.attributes.hp.value=hp;assert.equal(harvest.isDefeatedEnemy(token),false)}npc.system.attributes.hp.value=0;token.disposition=1;assert.equal(harvest.isDefeatedEnemy(token),false);token.disposition=-1;npc.type="character";assert.equal(harvest.isDefeatedEnemy(token),false)});
test("inventário é resolvido pelo personagem controlado ou atribuído ao jogador",()=>{reset();assert.equal(harvest.harvestDestination(player,[]),hero);assert.equal(harvest.harvestDestination(player,[{actor:hero}]),hero);const other={...hero,id:"other",uuid:"Actor.other"};assert.equal(harvest.harvestDestination(player,[{actor:hero},{actor:other}]),null)});
test("não usa como destino um NPC ou personagem que o jogador não controla",()=>{reset();player.character=npc;game.actors.delete(hero.id);assert.equal(harvest.harvestDestination(player,[{actor:npc}]),null)});
test("anatomia automática usa apenas partes reais da criatura na planilha",()=>{reset();const parts=harvest.availableHarvestParts(token);assert.equal(parts.length,15);assert.ok(parts.some(part=>part.part==="Claws"));assert.ok(!parts.some(part=>part.part==="Tentacles"))});
test("nomes numerados usam o mesmo cadastro, sem correspondências por trechos arbitrários",()=>{reset();npc.name="Ratling Warrior 2";token.name=npc.name;assert.equal(harvest.harvestProfile(token).catalogName,"Ratling Warrior");npc.name="Ratling Warrior Mutant";token.name=npc.name;assert.equal(harvest.harvestProfile(token),null)});
test("criatura desconhecida não recebe todas as partes genéricas",async()=>{reset();npc.name=token.name="Criatura desconhecida";assert.deepEqual(harvest.availableHarvestParts(token),[]);const msg=message();await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"failed");assert.equal(componentsOf(hero).length,0)});
test("vínculo do mestre permite coleta com nome personalizado e preserva a espécie para receitas",async()=>{reset();npc.name=token.name="Rato da Ponte";token.flags.harvestMonsterId="monster-161";const msg=message();await harvest.ingestHarvestMessage(msg);const component=componentsOf(hero)[0];assert.equal(result(msg).status,"completed");assert.match(component.name,/Rato da Ponte/);assert.equal(component.flags[ID].sourceMonsterName,"Ratling Warrior");component.flags[ID].rarity="rare";assert.equal(canStudy(component,data.recipes.find(r=>r.originalName==="Rat Tooth Dagger")),true)});
test("vínculo inválido não é substituído silenciosamente por outra anatomia",()=>{reset();token.flags.harvestMonsterId="invalid";assert.equal(harvest.harvestProfile(token),null)});
test("coleta preenche raridade, nome, descrição, retrato e origem sem dados enviados pelo jogador",async()=>{reset();npc.img="actors/ratling.webp";const msg=message({extra:{rarity:"legendary",quantity:999,monster:"Dragon",portrait:"wrong.webp"}});await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"completed");const component=componentsOf(hero)[0];assert.equal(component.name,"Garras (Ratling Warrior) | (Comum)");assert.equal(component.system.quantity,1);assert.equal(component.system.rarity,"common");assert.equal(component.system.container,tools.id);assert.match(component.system.description.value,/MONSTRUOSIDADE/);assert.match(component.system.description.value,/actors\/ratling.webp/);assert.equal(component.flags[ID].origin,token.uuid);assert.equal(token.flags.harvests["natural:claws"].status,"completed")});
test("duplo clique ou reprocessamento da mensagem não duplica o componente",async()=>{reset();const msg=message();await Promise.all([harvest.ingestHarvestMessage(msg),harvest.ingestHarvestMessage(msg)]);assert.equal(componentsOf(hero).length,1)});
test("dois pedidos simultâneos da mesma parte do mesmo cadáver produzem uma única coleta",async()=>{reset();const a=message(),b=message();await Promise.all([harvest.ingestHarvestMessage(a),harvest.ingestHarvestMessage(b)]);assert.equal(componentsOf(hero).length,1);assert.equal(result(a).status,"completed");assert.equal(result(b).status,"failed");assert.match(result(b).error,/já foi coletado/)});
test("a mesma parte não pode ser retirada novamente por outro jogador",async()=>{reset();const first=message();await harvest.ingestHarvestMessage(first);const other={id:"other-player",isGM:false,viewedScene:"scene"};const otherHero={...hero,id:"other",uuid:"Actor.other",items:new Collection(),testUserPermission(user){return user.id===other.id}};documents.set(otherHero.uuid,otherHero);const second=message({author:other,destination:otherHero});await harvest.ingestHarvestMessage(second);assert.equal(result(second).status,"failed");assert.equal(componentsOf(otherHero).length,0)});
test("partes diferentes do mesmo cadáver continuam disponíveis",async()=>{reset();await harvest.ingestHarvestMessage(message());assert.ok(!harvest.availableHarvestParts(token).some(part=>part.part==="Claws"));const second=message({key:"organs:heart"});await harvest.ingestHarvestMessage(second);assert.equal(result(second).status,"completed");assert.equal(componentsOf(hero).length,2)});
test("dois tokens do mesmo ator são cadáveres diferentes",async()=>{reset();const secondToken=tokenDocument("corpse-two");await harvest.ingestHarvestMessage(message());await harvest.ingestHarvestMessage(message({source:secondToken}));assert.equal(componentsOf(hero).length,2);assert.equal(new Set(componentsOf(hero).map(item=>item.flags[ID].origin)).size,2)});
test("parte não existente na criatura e destino sem permissão são rejeitados",async()=>{reset();const wrongPart=message({key:"natural:tentacles"});await harvest.ingestHarvestMessage(wrongPart);assert.equal(result(wrongPart).status,"failed");const stranger={id:"stranger",viewedScene:"scene"};const wrongActor=message({author:stranger});await harvest.ingestHarvestMessage(wrongActor);assert.equal(result(wrongActor).status,"failed");assert.equal(componentsOf(hero).length,0)});
test("criatura viva, escondida ou de outra cena não é coletável",async()=>{reset();npc.system.attributes.hp.value=1;const alive=message();await harvest.ingestHarvestMessage(alive);assert.equal(result(alive).status,"failed");npc.system.attributes.hp.value=0;token.hidden=true;const hidden=message();await harvest.ingestHarvestMessage(hidden);assert.equal(result(hidden).status,"failed");token.hidden=false;player.viewedScene="other";const scene=message();await harvest.ingestHarvestMessage(scene);assert.equal(result(scene).status,"failed");assert.equal(componentsOf(hero).length,0)});
test("cura durante a consulta da imagem impede coleta antes de gravar o inventário",async()=>{reset();const get=game.settings.get;game.settings.get=function(scope,key){if(key==="componentImages")npc.system.attributes.hp.value=3;return get(scope,key)};const msg=message();await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"failed");assert.equal(componentsOf(hero).length,0);assert.equal(token.flags.harvests,undefined)});
test("falha no inventário libera a parte para uma nova tentativa",async()=>{reset();hero.failCreate=true;const first=message();await harvest.ingestHarvestMessage(first);assert.equal(result(first).status,"failed");assert.equal(token.flags.harvests["natural:claws"].status,"available");const second=message();await harvest.ingestHarvestMessage(second);assert.equal(result(second).status,"completed");assert.equal(componentsOf(hero).length,1)});
test("resposta perdida após criar o item não cria uma segunda cópia",async()=>{reset();hero.failAfterCreate=true;const msg=message();await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"completed");assert.equal(componentsOf(hero).length,1)});
test("reserva interrompida sem item é recuperada automaticamente",async()=>{reset();token.flags.harvests={"natural:claws":{status:"reserved",requestId:"old",itemId:"missing",actorUuid:hero.uuid}};const msg=message();await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"completed");assert.equal(componentsOf(hero).length,1)});
test("reserva interrompida com item já criado é concluída sem duplicação",async()=>{reset();const msg=message(),request=msg.flags.harvestRequest;hero.items.set(request.id,{id:request.id,name:"Garras",type:"loot",system:{quantity:1,container:tools.id},flags:{[ID]:{kind:"component",harvestRequestId:request.id}},getFlag(_scope,key){return this.flags[ID][key]}});token.flags.harvests={"natural:claws":{status:"reserved",requestId:request.id,itemId:request.id,actorUuid:hero.uuid}};await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"completed");assert.equal(componentsOf(hero).length,1)});
test("falha temporária no aviso não transforma uma coleta concluída em nova tentativa",async()=>{reset();const msg=message();msg.failPublish=true;await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"completed");assert.equal(componentsOf(hero).length,1)});
test("reconexão processa pedidos pendentes automaticamente",async()=>{reset();const msg=message();await harvest.rescanHarvestRequests();assert.equal(result(msg).status,"completed");assert.equal(componentsOf(hero).length,1)});
test("a coleta é processada apenas pelo mestre ativo e exige mestre conectado no cliente",async()=>{reset();game.user=player;const msg=message();await harvest.ingestHarvestMessage(msg);assert.equal(result(msg),undefined);gm.active=false;game.users.activeGM=null;await assert.rejects(harvest.requestTokenHarvest(token,hero,"natural:claws"),/mestre conectado/);assert.equal(componentsOf(hero).length,0)});
test("ferramenta exige nome completo, tipo Container e quantidade positiva",()=>{
  reset();assert.equal(harvestTools(hero),tools);
  for(const name of ["Harvesting Tools","Monster Harvesting Tools Extra","Ferramentas de coleta"]){tools.name=name;assert.equal(harvestTools(hero),undefined)}
  tools.name="  monster harvesting tools  ";assert.equal(harvestTools(hero),tools);
  for(const type of ["loot","tool","equipment"]){tools.type=type;assert.equal(harvestTools(hero),undefined)}
  tools.type="container";tools.system.quantity=0;assert.equal(harvestTools(hero),undefined);
});
test("cliente sem ferramenta não envia pedido de coleta",async()=>{
  reset();game.user=player;hero.items.delete(tools.id);let sent=false;
  globalThis.ChatMessage={async create(){sent=true;throw new Error("Não deveria enviar")}};
  await assert.rejects(harvest.requestTokenHarvest(token,hero,"natural:claws"),/Monster Harvesting Tools/);assert.equal(sent,false);assert.equal(token.flags.harvests,undefined);
});
test("mestre rejeita pedido sem ferramenta, com tipo errado ou com quantidade zero",async()=>{
  for(const invalid of [()=>hero.items.delete(tools.id),()=>tools.type="tool",()=>tools.name="Other Tools",()=>tools.system.quantity=0]){
    reset();invalid();const msg=message({extra:{containerId:tools.id}});await harvest.ingestHarvestMessage(msg);
    assert.equal(result(msg).status,"failed");assert.match(result(msg).error,/Monster Harvesting Tools/);assert.equal(componentsOf(hero).length,0);assert.equal(token.flags.harvests,undefined);
  }
});
test("ferramenta em outro inventário ou em Itens do mundo não permite coleta",async()=>{
  reset();hero.items.delete(tools.id);game.items=new Collection([[tools.id,tools]]);npc.items=[tools];const msg=message();await harvest.ingestHarvestMessage(msg);
  assert.equal(result(msg).status,"failed");assert.equal(componentsOf(hero).length,0);
});
test("destino do contêiner é escolhido pelo mestre sem confiar no pedido",async()=>{
  reset();const msg=message({extra:{containerId:"foreign-container",container:"Item.world",system:{container:null}}});await harvest.ingestHarvestMessage(msg);
  assert.equal(result(msg).status,"completed");assert.equal(componentsOf(hero)[0].system.container,tools.id);assert.equal(tools.system.quantity,1);
});
test("retirar ferramenta durante a consulta da imagem cancela a coleta",async()=>{
  reset();const get=game.settings.get;game.settings.get=function(scope,key){if(key==="componentImages")hero.items.delete(tools.id);return get(scope,key)};
  const msg=message();await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"failed");assert.match(result(msg).error,/Monster Harvesting Tools/);assert.equal(componentsOf(hero).length,0);assert.equal(token.flags.harvests,undefined);
});
test("retirar ferramenta durante a reserva libera a parte sem criar item solto",async()=>{
  reset();const set=token.setFlag;token.setFlag=async function(scope,key,value){await set.call(this,scope,key,value);if(value["natural:claws"]?.status==="reserved")hero.items.delete(tools.id)};
  const msg=message();await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"failed");assert.equal(componentsOf(hero).length,0);assert.equal(token.flags.harvests["natural:claws"].status,"available");
});
test("jogador pode tirar componente do contêiner e reprocessar não o guarda novamente",async()=>{
  reset();const first=message();await harvest.ingestHarvestMessage(first);const component=componentsOf(hero)[0];assert.equal(component.system.container,tools.id);
  component.system.container=null;delete first.flags.harvestResult;await harvest.ingestHarvestMessage(first);assert.equal(result(first).status,"completed");assert.equal(component.system.container,null);assert.equal(componentsOf(hero).length,1);
  await harvest.ingestHarvestMessage(message({key:"organs:heart"}));const heart=componentsOf(hero).find(item=>item.id!==component.id);assert.equal(heart.system.container,tools.id);assert.equal(component.system.container,null);
});
test("coleta já entregue é reconhecida mesmo se ferramenta foi removida depois",async()=>{
  reset();const msg=message();await harvest.ingestHarvestMessage(msg);const component=componentsOf(hero)[0];component.system.container=null;hero.items.delete(tools.id);delete msg.flags.harvestResult;
  await harvest.ingestHarvestMessage(msg);assert.equal(result(msg).status,"completed");assert.equal(componentsOf(hero).length,1);assert.equal(component.system.container,null);
  const next=message({key:"organs:heart"});await harvest.ingestHarvestMessage(next);assert.equal(result(next).status,"failed");assert.match(result(next).error,/Monster Harvesting Tools/);
});
