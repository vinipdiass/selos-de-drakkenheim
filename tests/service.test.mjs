import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {ID,componentData} from "../selos-de-drakkenheim/scripts/core.mjs";

const data=JSON.parse(fs.readFileSync(new URL("../selos-de-drakkenheim/data/catalog.json",import.meta.url)));
const recipe=data.recipes.find(r=>r.originalName==="Potion of Healing");
let settings,actor,gm,player,current,documents,chatCount,idCounter,chatMessages;
const clone=structuredClone;
class Collection extends Map {filter(fn){return [...this.values()].filter(fn);}find(fn){return [...this.values()].find(fn);}get contents(){return [...this.values()];}}
class MockItem {
  constructor(source){Object.assign(this,clone(source));this.id=source._id;this.name??=this.id;this.documentName="Item";}
  getFlag(_scope,key){return this.flags?.[ID]?.[key];}
  toObject(){const {_id,name,type,system,flags}=this;return clone({_id,name,type,system,flags});}
}
function reset(){
  idCounter=0;chatCount=0;chatMessages=[];settings=new Map([["recipeResults",{}],["customRecipes",[]],["requests",[]],["studyMode","score"]]);gm={id:"gm",isGM:true,active:true};player={id:"player",isGM:false,active:true};current=gm;
  const users=new Collection([[gm.id,gm],[player.id,player]]);users.activeGM=gm;
  actor={id:"hero",uuid:"Actor.hero",documentName:"Actor",type:"character",name:"Heroína",system:{abilities:{int:{value:2,mod:0}}},flags:{[ID]:{recipes:[{id:recipe.id}]}},items:new Collection(),getFlag(_scope,key){return clone(this.flags[ID][key]);},async setFlag(_scope,key,value){this.flags[ID][key]=clone(value);},testUserPermission(user){return user?.id==="gm" || user?.id==="player";},async update(changes){for(const [key,value]of Object.entries(changes))this.flags[ID][key.split(".").at(-1)]=clone(value);},async createEmbeddedDocuments(_type,sources){if(this.failCreate){this.failCreate=false;throw new Error("Falha ao criar");}return sources.map(source=>{const item=new MockItem(source);this.items.set(item.id,item);return item;});},async updateEmbeddedDocuments(_type,changes){if(this.failUpdate){this.failUpdate=false;this.items.get(changes[0]._id).system.quantity=0;throw new Error("Falha parcial no inventário");}for(const change of changes)this.items.get(change._id).system.quantity=change["system.quantity"];},async deleteEmbeddedDocuments(_type,ids){for(const id of ids)this.items.delete(id);}};
  const source=new MockItem({_id:"template",name:"Poção original",type:"consumable",system:{quantity:5,rarity:"common",description:{value:"Cura 2d4+2"},activities:{heal:{formula:"2d4+2"}}},flags:{}});
  documents=new Map([[actor.uuid,actor],["Item.template",source]]);
  globalThis.game={get user(){return current;},users,actors:new Collection([[actor.id,actor]]),settings:{get(_scope,key){return clone(settings.get(key));},async set(_scope,key,value){settings.set(key,clone(value));}},messages:{contents:[]}};
  globalThis.Hooks={callAll(){}};globalThis.ui={notifications:{info(){}}};globalThis.foundry={utils:{randomID(){return String(++idCounter).padStart(16,"A");}}};globalThis.fromUuid=async uuid=>documents.get(uuid);globalThis.ChatMessage={getSpeaker({actor}){return{actor:actor.id};},async create(message){chatCount++;chatMessages.push(message);return message;}};
  const types=[["animus","Animus","Ânima"],["fluid","Monster Blood","Sangue de monstro"],["organs","Heart","Coração"]];
  for(const [index,[category,part,name]] of types.entries()){const value=componentData({monster:{name:"Ratling",type:"monstrosity"},part:{category,part,name},rarity:"common",quantity:2,origin:`origin-${index}`});const item=new MockItem({_id:`input-${index}`,...value});actor.items.set(item.id,item);}
}
globalThis.fetch=async()=>({ok:true,json:async()=>clone(data)});
const catalog=await import("../selos-de-drakkenheim/scripts/catalog.mjs");await catalog.loadCatalog();
const service=await import("../selos-de-drakkenheim/scripts/service.mjs");
function request(id="AAAAAAAAAAAAAA01"){return{id,actorUuid:actor.uuid,recipeId:recipe.id,assignments:[...actor.items.keys()],rarity:"common",workshop:"common",notes:"Oficina da praça",submittedAt:1,submittedBy:player.id,status:"pending"};}
function savePending(value=request()){settings.set("requests",[clone(value)]);return value;}
const approve=id=>service.resolveRequest(id,{approve:true,resultUuid:"Item.template",workshopConfirmed:true,conditionsConfirmed:true});
test("pedido de jogador não fabrica nem consome materiais",async()=>{reset();current=player;await service.submitRequest(actor,{...request(),notes:"Oficina"});assert.equal(chatCount,1);assert.equal(actor.items.size,3);assert.equal(actor.items.get("input-0").system.quantity,2);assert.deepEqual(settings.get("requests"),[]);});
test("jogador não consegue executar aprovação",async()=>{reset();const r=savePending();current=player;await assert.rejects(approve(r.id),/mestre ativo/);assert.equal(actor.items.size,3);});
test("aprovação fabrica uma cópia funcional e consome só as unidades necessárias",async()=>{reset();const r=savePending();await approve(r.id);assert.equal(actor.items.size,4);for(const id of r.assignments)assert.equal(actor.items.get(id).system.quantity,1);const output=[...actor.items.values()].find(i=>i.flags[ID]?.kind==="crafted");assert.equal(output.name,"Poção de Cura");assert.equal(output.system.quantity,1);assert.equal(output.system.activities.heal.formula,"2d4+2");assert.equal(settings.get("requests")[0].status,"completed");});
test("aprovação repetida não duplica o resultado",async()=>{reset();const r=savePending();const results=await Promise.allSettled([approve(r.id),approve(r.id)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(actor.items.size,4);});
test("recusar preserva todos os componentes",async()=>{reset();const r=savePending();await service.resolveRequest(r.id,{approve:false});assert.equal(actor.items.size,3);assert.equal(actor.items.get("input-0").system.quantity,2);assert.equal(settings.get("requests")[0].status,"rejected");});
test("inventário alterado desde o pedido impede fabricação",async()=>{reset();const r=savePending();actor.items.get("input-1").system.quantity=0;await assert.rejects(approve(r.id),/incompatível/);assert.equal(actor.items.size,3);});
test("oficina sem confirmação impede fabricação",async()=>{reset();const r=savePending();await assert.rejects(service.resolveRequest(r.id,{approve:true,resultUuid:"Item.template"}),/oficina/);assert.equal(actor.items.size,3);});
test("item de resultado ausente impede consumo",async()=>{reset();const r=savePending();await assert.rejects(service.resolveRequest(r.id,{approve:true,resultUuid:"Item.missing",workshopConfirmed:true}),/Vincule/);assert.equal(actor.items.get("input-0").system.quantity,2);});
test("falha ao criar o resultado restaura inventário",async()=>{reset();const r=savePending();actor.failCreate=true;await assert.rejects(approve(r.id),/restaurados/);assert.equal(actor.items.size,3);assert.equal(settings.get("requests")[0].status,"pending");});
test("falha parcial de consumo remove resultado e restaura quantidades",async()=>{reset();const r=savePending();actor.failUpdate=true;await assert.rejects(approve(r.id),/restaurados/);assert.equal(actor.items.size,3);for(const id of r.assignments)assert.equal(actor.items.get(id).system.quantity,2);await approve(r.id);assert.equal(actor.items.size,4);});
test("recuperação de conclusão já persistida não fabrica outra cópia",async()=>{reset();const r=savePending();await approve(r.id);const completed=settings.get("requests")[0];settings.set("requests",[{...completed,status:"processing"}]);await service.recoverRequest(r.id);assert.equal(actor.items.size,4);assert.equal(settings.get("requests")[0].status,"completed");});
test("reconexão identifica transação interrompida e permite restaurar materiais",async()=>{reset();const r=savePending();settings.set("requests",[{...r,status:"processing"}]);const before=[...actor.items.values()].map(i=>i.toObject());actor.flags[ID].transaction={requestId:r.id,status:"processing",outputId:"unfinished",before};actor.items.get("input-0").system.quantity=0;await service.rescanRequests();assert.equal(settings.get("requests")[0].status,"recovery");await service.recoverRequest(r.id);assert.equal(actor.items.get("input-0").system.quantity,2);assert.equal(settings.get("requests")[0].status,"pending");});
test("reconexão finaliza registro de resultado já fabricado sem nova cópia",async()=>{reset();const r=savePending();await approve(r.id);settings.set("requests",[{...settings.get("requests")[0],status:"processing"}]);await service.rescanRequests();assert.equal(settings.get("requests")[0].status,"completed");assert.equal(actor.items.size,4);});
test("anatomia genérica oferece uma única ânima com nome correto",()=>{reset();const parts=catalog.genericParts().filter(p=>p.category==="animus");assert.equal(parts.length,1);assert.equal(parts[0].name,"Ânima");assert.equal(parts[0].part,"Animus");});
test("ingestão usa autor da mensagem e ignora identidade forjada nos dados",async()=>{reset();const r=request();const stranger={id:"stranger",isGM:false};await service.ingestMessage({id:"chat1",timestamp:42,author:stranger,getFlag(_scope,key){return key==="kind"?"craft-request":{...r,submittedBy:gm.id};}});assert.equal(settings.get("requests").length,0);await service.ingestMessage({id:"chat2",timestamp:43,author:player,getFlag(_scope,key){return key==="kind"?"craft-request":{...r,submittedBy:gm.id};}});assert.equal(settings.get("requests")[0].submittedBy,player.id);});
test("estudo sorteia a única receita desconhecida, persiste limite e preserva componente",async()=>{reset();actor.flags[ID].recipes=data.recipes.filter(r=>r.id!==recipe.id).map(r=>({id:r.id}));await service.startRest(actor,"rest1");const result=await service.studyComponents(actor,["input-0"],"rest1");assert.deepEqual(result.learned.map(r=>r.id),[recipe.id]);assert.equal(actor.getFlag(ID,"recipes").length,data.recipes.length);assert.equal(actor.getFlag(ID,"study").used.length,1);assert.equal(actor.items.get("input-0").system.quantity,2);await assert.rejects(service.studyComponents(actor,["input-0"],"rest1"),/já foi estudado/);});
test("estudo rejeita repetição de item, escolha de receita e descanso anterior",async()=>{reset();actor.flags[ID].recipes=[];await service.startRest(actor,"rest2");await assert.rejects(service.studyComponents(actor,["input-0","input-0"],"rest2"),/uma vez/);await assert.rejects(service.studyComponents(actor,[{itemId:"input-0",recipeId:recipe.id}],"rest2"),/apenas os componentes/);await assert.rejects(service.studyComponents(actor,["input-0"],"rest1"),/descanso mudou/);});
test("sem receitas novas, estudo não repete receita nem gasta análise",async()=>{reset();actor.flags[ID].recipes=data.recipes.map(r=>({id:r.id}));await service.startRest(actor,"rest1");const result=await service.studyComponents(actor,["input-0"],"rest1");assert.equal(result.learned.length,0);assert.equal(result.unavailable[0].itemId,"input-0");assert.deepEqual(actor.getFlag(ID,"study").used,[]);assert.equal(actor.getFlag(ID,"recipes").length,data.recipes.length);});
test("estudo de dois componentes com receitas sobrepostas aprende duas receitas inéditas",async()=>{reset();const scroll=data.recipes.find(r=>r.originalName==="Spell Scroll (Cantrip or 1st Level)");actor.flags[ID].recipes=data.recipes.filter(r=>![recipe.id,scroll.id].includes(r.id)).map(r=>({id:r.id}));await service.startRest(actor,"rest1");const result=await service.studyComponents(actor,["input-0","input-2"],"rest1");assert.equal(result.learned.length,2);assert.deepEqual(new Set(result.learned.map(r=>r.id)),new Set([recipe.id,scroll.id]));assert.equal(result.learned.find(r=>r.componentId==="input-2").id,recipe.id);assert.equal(actor.getFlag(ID,"study").used.length,2);});
test("se uma receita é a única descoberta possível para dois componentes, aprende uma só",async()=>{reset();actor.flags[ID].recipes=data.recipes.filter(r=>r.id!==recipe.id).map(r=>({id:r.id}));await service.startRest(actor,"rest1");const result=await service.studyComponents(actor,["input-0","input-2"],"rest1");assert.equal(result.learned.length,1);assert.equal(result.unavailable.length,1);assert.equal(actor.getFlag(ID,"study").used.length,1);});
test("estudo confere limites, inventário atual e falhas antes de gravar resultados",async()=>{reset();actor.flags[ID].recipes=[];await service.startRest(actor,"rest1");await assert.rejects(service.studyComponents(actor,["input-0","input-1","input-2"],"rest1"),/limite/);actor.items.delete("input-1");await assert.rejects(service.studyComponents(actor,["input-1"],"rest1"),/removido/);actor.update=async()=>{throw new Error("Falha na gravação")};await assert.rejects(service.studyComponents(actor,["input-0"],"rest1"),/Falha na gravação/);assert.deepEqual(actor.getFlag(ID,"recipes"),[]);assert.deepEqual(actor.getFlag(ID,"study").used,[]);});
test("concessão manual é exclusiva do mestre e não duplica receitas",async()=>{reset();actor.flags[ID].recipes=[];current=player;await assert.rejects(service.grantRecipe(actor,recipe.id),/mestre/);current=gm;await service.grantRecipe(actor,recipe.id);await service.grantRecipe(actor,recipe.id);assert.equal(actor.getFlag(ID,"recipes").length,1);});
test("descoberta por estudo anuncia no chat público o personagem e os dois nomes do item após salvar",async()=>{
  reset();current=player;actor.flags[ID].recipes=data.recipes.filter(r=>r.id!==recipe.id).map(r=>({id:r.id}));await service.startRest(actor,"rest-chat");
  const create=ChatMessage.create;
  ChatMessage.create=async message=>{assert.ok(actor.getFlag(ID,"recipes").some(r=>r.id===recipe.id));assert.deepEqual(actor.getFlag(ID,"study").used,["input-0"]);return create(message);};
  await service.studyComponents(actor,["input-0"],"rest-chat");
  assert.equal(chatCount,1);const message=chatMessages[0];
  assert.match(message.content,/Heroína/);assert.match(message.content,/aprendeu uma nova receita/);assert.match(message.content,/Poção de Cura/);assert.match(message.content,/Potion of Healing/);assert.match(message.content,/Material estudado: Ânima/);
  assert.deepEqual(message.whisper,[]);assert.equal(message.speaker.actor,actor.id);assert.equal(message.flags[ID].kind,"recipe-discovery");assert.deepEqual(message.flags[ID].recipeIds,[recipe.id]);assert.equal(message.flags[ID].restId,"rest-chat");
  await assert.rejects(service.studyComponents(actor,["input-0"],"rest-chat"),/já foi estudado/);assert.equal(chatCount,1);
});
test("estudo em lote publica uma mensagem com cada descoberta uma única vez",async()=>{
  reset();const scroll=data.recipes.find(r=>r.originalName==="Spell Scroll (Cantrip or 1st Level)");
  actor.flags[ID].recipes=data.recipes.filter(r=>![recipe.id,scroll.id].includes(r.id)).map(r=>({id:r.id}));await service.startRest(actor,"rest-chat");
  await service.studyComponents(actor,["input-0","input-2"],"rest-chat");assert.equal(chatCount,1);
  const message=chatMessages[0];assert.match(message.content,/Receitas aprendidas/);assert.equal((message.content.match(/<li>/g)??[]).length,2);
  for(const row of [recipe,scroll]){assert.ok(message.content.includes(row.name));assert.ok(message.content.includes(row.originalName));}
});
test("estudo sem descoberta não anuncia receita aprendida no chat",async()=>{
  reset();actor.flags[ID].recipes=data.recipes.map(r=>({id:r.id}));await service.startRest(actor,"rest-chat");await service.studyComponents(actor,["input-0"],"rest-chat");assert.equal(chatCount,0);
});
test("falha ao salvar a descoberta impede o anúncio no chat",async()=>{
  reset();actor.flags[ID].recipes=[];await service.startRest(actor,"rest-chat");actor.update=async()=>{throw new Error("Sem conexão")};
  await assert.rejects(service.studyComponents(actor,["input-0"],"rest-chat"),/Sem conexão/);assert.equal(chatCount,0);
});
test("anúncio escapa nomes personalizados nos dois idiomas",async()=>{
  reset();actor.name='<img src=x onerror="evil()">';actor.items.get("input-0").name="<script>material</script>";
  const custom={id:"custom-chat",name:"Poção <teste>",originalName:'Potion <test> & "Magic"',rarity:"common",requirements:[{category:"animus",raw:"Animus"}]};
  settings.set("customRecipes",[custom]);actor.flags[ID].recipes=data.recipes.map(r=>({id:r.id}));await service.startRest(actor,"rest-chat");await service.studyComponents(actor,["input-0"],"rest-chat");
  const content=chatMessages[0].content;assert.ok(!content.includes("<script>"));assert.ok(!content.includes("<img"));assert.ok(content.includes("Poção &lt;teste&gt;"));assert.ok(content.includes("Potion &lt;test&gt; &amp; &quot;Magic&quot;"));
});
test("falha no anúncio preserva a receita salva e impede novo sorteio",async t=>{
  reset();t.mock.method(console,"error",()=>{});actor.flags[ID].recipes=data.recipes.filter(r=>r.id!==recipe.id).map(r=>({id:r.id}));await service.startRest(actor,"rest-chat");
  ChatMessage.create=async()=>{throw new Error("Chat indisponível")};const result=await service.studyComponents(actor,["input-0"],"rest-chat");
  assert.equal(result.learned[0].id,recipe.id);assert.match(result.chatError,/receitas foram salvas/);assert.ok(actor.getFlag(ID,"recipes").some(r=>r.id===recipe.id));assert.deepEqual(actor.getFlag(ID,"study").used,["input-0"]);
  await assert.rejects(service.studyComponents(actor,["input-0"],"rest-chat"),/já foi estudado/);
});
test("componentes dentro de Monster Harvesting Tools continuam disponíveis para estudo e fabricação",async()=>{
  reset();const tools=new MockItem({_id:"harvesting-tools",name:"Monster Harvesting Tools",type:"container",system:{quantity:1},flags:{}});actor.items.set(tools.id,tools);
  const assignments=["input-0","input-1","input-2"];for(const id of assignments)actor.items.get(id).system.container=tools.id;
  actor.flags[ID].recipes=data.recipes.filter(r=>r.id!==recipe.id).map(r=>({id:r.id}));await service.startRest(actor,"rest-container");
  const study=await service.studyComponents(actor,["input-0"],"rest-container");assert.equal(study.learned[0].id,recipe.id);
  const pending=savePending({...request(),assignments});await approve(pending.id);
  for(const id of assignments){assert.equal(actor.items.get(id).system.quantity,1);assert.equal(actor.items.get(id).system.container,tools.id)}
  assert.equal(tools.system.quantity,1);assert.equal(settings.get("requests")[0].status,"completed");
});
test("jogador não pode remover receitas mesmo sendo dono do personagem",async()=>{
  reset();current=player;await assert.rejects(service.revokeRecipe(actor,recipe.id),/Somente o mestre/);assert.deepEqual(actor.getFlag(ID,"recipes"),[{id:recipe.id}]);
});
test("remoção pelo mestre preserva outras receitas, estudos e inventário",async()=>{
  reset();const other=data.recipes.find(row=>row.id!==recipe.id),kept={id:other.id,learnedAt:42,source:"Estudo"};actor.flags[ID].recipes=[{id:recipe.id},kept];await service.startRest(actor,"rest-remove");
  const study=actor.getFlag(ID,"study"),items=[...actor.items.values()].map(item=>item.toObject());
  assert.equal(await service.revokeRecipe(actor,recipe.id),true);assert.deepEqual(actor.getFlag(ID,"recipes"),[kept]);assert.deepEqual(actor.getFlag(ID,"study"),study);assert.deepEqual([...actor.items.values()].map(item=>item.toObject()),items);assert.ok(catalog.getRecipe(recipe.id));
});
test("remover uma receita só altera o personagem escolhido",async()=>{
  reset();const other={...actor,id:"other",uuid:"Actor.other",flags:clone(actor.flags)};await service.revokeRecipe(other,recipe.id);
  assert.deepEqual(other.getFlag(ID,"recipes"),[]);assert.deepEqual(actor.getFlag(ID,"recipes"),[{id:recipe.id}]);
});
test("remoção repetida não altera receitas e permite ensinar novamente",async()=>{
  reset();assert.equal(await service.revokeRecipe(actor,recipe.id),true);assert.equal(await service.revokeRecipe(actor,recipe.id),false);
  await service.grantRecipe(actor,recipe.id);await service.grantRecipe(actor,recipe.id);assert.equal(actor.getFlag(ID,"recipes").length,1);assert.equal(actor.getFlag(ID,"recipes")[0].id,recipe.id);
});
test("remoção exige personagem válido e identificador de receita",async()=>{
  reset();await assert.rejects(service.revokeRecipe(null,recipe.id),/personagem válido/);actor.type="npc";await assert.rejects(service.revokeRecipe(actor,recipe.id),/personagem válido/);actor.type="character";
  for(const id of [undefined,"",{}])await assert.rejects(service.revokeRecipe(actor,id),/Informe a receita/);
  assert.deepEqual(actor.getFlag(ID,"recipes"),[{id:recipe.id}]);
});
test("falha ao salvar a remoção preserva o conhecimento",async()=>{
  reset();actor.setFlag=async()=>{throw new Error("Sem conexão")};await assert.rejects(service.revokeRecipe(actor,recipe.id),/Sem conexão/);assert.deepEqual(actor.getFlag(ID,"recipes"),[{id:recipe.id}]);
});
test("pedido pendente não fabrica receita removida do personagem",async()=>{
  reset();const pending=savePending();await service.revokeRecipe(actor,recipe.id);await assert.rejects(approve(pending.id),/não conhece mais esta receita/);
  assert.equal(actor.items.size,3);assert.equal(actor.items.get("input-0").system.quantity,2);assert.equal(settings.get("requests")[0].status,"pending");
});
