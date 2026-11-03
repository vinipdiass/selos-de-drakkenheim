import {ID,RARITIES,assert,studyLimit,drawStudyRecipes,validateCombination,workshopMeets,escapeHTML} from "./core.mjs";
import {getRecipe,recipes,components,knownRecipes,owns,primaryGM} from "./catalog.mjs";
import {selectedResult,PHYSICAL_ITEMS} from "./bindings.mjs";

let queue=Promise.resolve();
export function serialize(task) {const result=queue.then(task);queue=result.catch(()=>{});return result;}
export const isAuthority = () => game.user.isGM && primaryGM()?.id===game.user.id;
export const requireGM = () => assert(isAuthority(),"Esta ação deve ser feita pelo mestre ativo.");
export function requests() { return game.settings.get(ID,"requests"); }
async function saveRequest(request) {
  const list=structuredClone(requests());
  const at=list.findIndex(r=>r.id===request.id);
  if(at<0) list.push(request);else list[at]=request;
  await game.settings.set(ID,"requests",list);
  Hooks.callAll(`${ID}.updated`);
}
export async function grantRecipe(actor,recipeId,source="Concedida pelo mestre") {
  assert(game.user.isGM,"Somente o mestre pode conceder receitas manualmente.");
  assert(getRecipe(recipeId),"Receita não encontrada.");
  return addRecipes(actor,[recipeId],source);
}
export function revokeRecipe(actor,recipeId) {
  return serialize(async()=>{
    assert(game.user.isGM,"Somente o mestre pode remover receitas dos personagens.");
    assert(actor?.documentName==="Actor" && actor.type==="character" && owns(actor),"Selecione um personagem válido para remover a receita.");
    assert(typeof recipeId==="string" && recipeId.length>0,"Informe a receita que será removida.");
    const old=knownRecipes(actor),remaining=old.filter(entry=>entry.id!==recipeId);
    if(remaining.length===old.length)return false;
    await actor.setFlag(ID,"recipes",remaining);
    Hooks.callAll(`${ID}.updated`,actor);
    return true;
  });
}
async function addRecipes(actor,ids,source) {
  const old=knownRecipes(actor);
  const additions=ids.filter(id=>!old.some(r=>r.id===id)).map(id=>({id,learnedAt:Date.now(),source}));
  if(additions.length) await actor.setFlag(ID,"recipes",[...old,...additions]);
  return additions;
}
export async function startRest(actor,restId) {
  assert(owns(actor),"Você precisa controlar este personagem.");
  const existing=actor.getFlag(ID,"study");
  if(existing?.restId===restId) return existing;
  const study={restId,used:[],createdAt:Date.now(),limit:studyLimit(actor,game.settings.get(ID,"studyMode"))};
  await actor.setFlag(ID,"study",study);
  return study;
}
export async function studyComponents(actor,itemIds,expectedRestId) {
  assert(owns(actor),"Você precisa controlar este personagem.");
  const study=actor.getFlag(ID,"study");
  assert(study && study.restId===expectedRestId,"O descanso mudou. Abra a análise novamente.");
  assert(Array.isArray(itemIds) && itemIds.every(id=>typeof id==="string"),"Envie apenas os componentes a estudar. A receita é sorteada pelo módulo.");
  assert(itemIds.length>0,"Selecione pelo menos um componente para estudar.");
  assert(new Set(itemIds).size===itemIds.length,"Cada componente pode ser estudado uma vez por descanso.");
  assert(study.used.length+itemIds.length<=study.limit,"O limite de componentes deste descanso foi excedido.");
  const inventory=components(actor),items=[];
  for(const itemId of itemIds) {
    const item=inventory.find(i=>i.id===itemId);
    assert(!study.used.includes(itemId),"Este componente já foi estudado neste descanso.");
    assert(item,"O componente foi removido ou não está mais disponível.");
    items.push(item);
  }
  const current=knownRecipes(actor);
  const draws=drawStudyRecipes(items,recipes(),current.map(recipe=>recipe.id));
  const additions=draws.map(draw=>({id:draw.recipeId,learnedAt:Date.now(),source:"Estudo aleatório em descanso longo",componentId:draw.itemId,componentName:items.find(item=>item.id===draw.itemId).name}));
  const unavailable=items.filter(item=>!draws.some(draw=>draw.itemId===item.id)).map(item=>({itemId:item.id,name:item.name}));
  if(!additions.length)return {learned:[],unavailable};
  // One document update keeps learned recipes and the rest allowance in sync.
  await actor.update({[`flags.${ID}.recipes`]:[...current,...additions],[`flags.${ID}.study`]:{...study,used:[...study.used,...draws.map(draw=>draw.itemId)]}});
  const chatError=await announceDiscoveries(actor,additions,{restId:study.restId});
  return {learned:additions,unavailable,...(chatError?{chatError}:{})};
}
export async function announceDiscoveries(actor,additions,context={}) {
  if(!additions.length)return;
  try{
    const cards=additions.map(entry=>{
      const recipe=getRecipe(entry.id);
      return `<li><strong lang="pt-BR">${escapeHTML(recipe?.name??"Receita indisponível")}</strong><span class="selos-recipe-original" lang="en">${escapeHTML(recipe?.originalName?.trim()||"Nome em inglês não informado")}</span><small>Material estudado: ${escapeHTML(entry.componentName)}</small></li>`;
    }).join("");
    await ChatMessage.create({content:`<div class="selos-chat selos-discovery-chat"><h3>${additions.length===1?"Receita aprendida":"Receitas aprendidas"}</h3><p><strong>${escapeHTML(actor.name)}</strong> aprendeu ${additions.length===1?"uma nova receita":"novas receitas"} ao estudar componentes.</p><ul>${cards}</ul></div>`,whisper:[],speaker:ChatMessage.getSpeaker({actor}),flags:{[ID]:{kind:"recipe-discovery",actorUuid:actor.uuid,...context,recipeIds:additions.map(entry=>entry.id)}}});
  }catch(error){
    // A chat failure must not undo a saved discovery or let the player reroll it.
    console.error(`${ID} | Não foi possível anunciar a descoberta no chat.`,error);
    return "As receitas foram salvas, mas não foi possível publicar a descoberta no chat.";
  }
}
export async function submitRequest(actor,{recipeId,assignments,rarity,workshop,notes,resultUuid}) {
  assert(owns(actor),"Você precisa controlar este personagem.");
  const recipe=getRecipe(recipeId);
  assert(recipe && knownRecipes(actor).some(r=>r.id===recipeId),"O personagem precisa conhecer a receita.");
  const actualRarity=recipe.rarity==="varies" ? rarity : recipe.rarity;
  const result=selectedResult(recipe,actualRarity,resultUuid);
  assert(result,"O mestre precisa vincular um item de resultado para esta receita e raridade. Se houver várias opções, escolha o item.");
  const requiredWorkshop=recipe.workshop==="varies" ? actualRarity : recipe.workshop;
  validateCombination(recipe,components(actor),assignments,actualRarity);
  assert(workshopMeets(workshop,requiredWorkshop),"A oficina informada tem raridade insuficiente.");
  const request={id:foundry.utils.randomID(),actorUuid:actor.uuid,recipeId,assignments,resultUuid:result.uuid,rarity:actualRarity,workshop,notes:String(notes??"").slice(0,2000),submittedAt:Date.now()};
  const gmIds=game.users.filter(u=>u.isGM).map(u=>u.id);
  assert(gmIds.length,"É necessário haver um mestre cadastrado no mundo.");
  await ChatMessage.create({content:`<div class="selos-chat"><h3>Pedido de fabricação</h3><p><strong>${escapeHTML(actor.name)}</strong> deseja fabricar <strong>${escapeHTML(recipe.name)}</strong>.</p><p>Oficina informada: ${RARITIES[workshop]}. Aguardando aprovação do mestre.</p><button type="button" data-selos-request="${request.id}">Revisar fabricação</button></div>`,whisper:[...new Set([...gmIds,game.user.id])],speaker:ChatMessage.getSpeaker({actor}),flags:{[ID]:{kind:"craft-request",request}}});
  ui.notifications.info("Pedido enviado ao mestre. Os componentes serão consumidos após a aprovação.");
  Hooks.callAll(`${ID}.updated`);
  return request;
}
export function ingestMessage(message) {
  if(!isAuthority() || message.getFlag(ID,"kind")!=="craft-request") return Promise.resolve();
  return serialize(async()=>{
    const data=message.getFlag(ID,"request");
    if(!/^[A-Za-z0-9]{16}$/.test(data?.id??"") || requests().some(r=>r.id===data.id)) return;
    const actor=await fromUuid(data.actorUuid);
    // ChatMessage.author is authenticated by Foundry; sender IDs in flags are never trusted.
    if(actor?.documentName!=="Actor" || actor.type!=="character" || !message.author || !owns(actor,message.author)) return;
    const recipe=getRecipe(data.recipeId);
    if(!recipe || !knownRecipes(actor).some(r=>r.id===recipe.id)) return;
    if(!Array.isArray(data.assignments) || data.assignments.length>50) return;
    const tier=recipe.rarity==="varies"?data.rarity:recipe.rarity,result=selectedResult(recipe,tier,data.resultUuid);
    if(!result)return;
    await saveRequest({resultUuid:result.uuid,id:data.id,actorUuid:actor.uuid,recipeId:recipe.id,assignments:data.assignments.map(String),rarity:recipe.rarity==="varies" ? data.rarity : recipe.rarity,workshop:data.workshop,notes:String(data.notes??"").slice(0,2000),submittedAt:message.timestamp,submittedBy:message.author.id,messageId:message.id,status:"pending"});
    ui.notifications.info(`Novo pedido de fabricação: ${actor.name}.`);
  });
}
export async function rescanRequests() {
  if(!isAuthority()) return;
  for(const message of game.messages.contents) await ingestMessage(message);
  await serialize(async()=>{
    for(const request of requests().filter(r=>["pending","processing"].includes(r.status))){
      const actor=await fromUuid(request.actorUuid),transaction=actor?.getFlag(ID,"transaction");
      if(transaction?.requestId!==request.id)continue;
      if(transaction.status==="completed")await saveRequest({...request,status:"completed",outputId:transaction.outputId});
      else if(transaction.status==="processing")await saveRequest({...request,status:"recovery",error:"A fabricação foi interrompida. Confira e restaure os materiais antes de continuar."});
    }
  });
}
async function rollback(actor,transaction) {
  if(actor.items.get(transaction.outputId)) await actor.deleteEmbeddedDocuments("Item",[transaction.outputId]);
  const updates=[],missing=[];
  for(const snapshot of transaction.before) {
    if(actor.items.get(snapshot._id)) updates.push({_id:snapshot._id,"system.quantity":snapshot.system.quantity});
    else missing.push(snapshot);
  }
  if(updates.length) await actor.updateEmbeddedDocuments("Item",updates);
  if(missing.length) await actor.createEmbeddedDocuments("Item",missing,{keepId:true});
  await actor.setFlag(ID,"transaction",{...transaction,status:"rolledBack"});
}
export function recoverRequest(id) {
  return serialize(async()=>{
    requireGM();
    const request=requests().find(r=>r.id===id);
    assert(request && ["processing","recovery"].includes(request.status),"Não há uma fabricação interrompida para restaurar.");
    const actor=await fromUuid(request.actorUuid),transaction=actor?.getFlag(ID,"transaction");
    assert(transaction?.requestId===id,"O registro da transação não foi encontrado. Confira o inventário antes de continuar.");
    if(transaction.status==="completed") {await saveRequest({...request,status:"completed",outputId:transaction.outputId});return;}
    await rollback(actor,transaction);
    await saveRequest({...request,status:"pending",error:"Materiais restaurados. O pedido pode ser revisado novamente."});
  });
}
export function resolveRequest(id,{approve,resultUuid,conditionsConfirmed=false,workshopConfirmed=false}={}) {
  return serialize(async()=>{
    requireGM();
    const request=requests().find(r=>r.id===id);
    assert(request?.status==="pending","Este pedido já foi processado ou precisa de recuperação.");
    const actor=await fromUuid(request.actorUuid);
    assert(actor,"O personagem deste pedido foi removido.");
    if(!approve) {
      await saveRequest({...request,status:"rejected",resolvedAt:Date.now(),resolvedBy:game.user.id});
      await notifyResult(request,actor,"recusado");return;
    }
    assert(!["processing","recovery"].includes(actor.getFlag(ID,"transaction")?.status),"Restaure a fabricação interrompida deste personagem antes de continuar.");
    const recipe=getRecipe(request.recipeId);
    assert(recipe && knownRecipes(actor).some(r=>r.id===recipe.id),"O personagem não conhece mais esta receita.");
    assert(owns(actor,game.users.get(request.submittedBy)),"O solicitante não controla mais este personagem.");
    const {counts,manual}=validateCombination(recipe,components(actor),request.assignments,request.rarity);
    const requiredWorkshop=recipe.workshop==="varies" ? request.rarity : recipe.workshop;
    assert(workshopConfirmed && workshopMeets(request.workshop,requiredWorkshop),"Confirme que a oficina informada está disponível e tem a raridade exigida.");
    assert(!manual.length || conditionsConfirmed,"Confirme os requisitos especiais da criatura na ficha do monstro.");
    const linked=selectedResult(recipe,request.rarity,request.resultUuid);
    assert(linked,"O item de resultado não está mais vinculado a esta receita e raridade.");
    assert(!resultUuid||resultUuid===linked.uuid,"O resultado precisa ser o item vinculado escolhido no pedido.");
    const source=await fromUuid(linked.uuid);
    assert(source?.documentName==="Item" && PHYSICAL_ITEMS.has(source.type),"Vincule um item físico do mundo ou de um compêndio para usar como resultado.");
    const output=source.toObject();delete output._stats;delete output.folder;delete output.ownership;
    output._id=foundry.utils.randomID();output.name=source.name;output.system.quantity=1;output.system.rarity=request.rarity;output.system.container=null;
    if("equipped"in output.system)output.system.equipped=false;
    if("attuned"in output.system)output.system.attuned=false;
    output.flags ??={};output.flags[ID]={kind:"crafted",recipeId:recipe.id,resultUuid:linked.uuid,requestId:id,craftedAt:Date.now(),approvedBy:game.user.id};
    const transaction={requestId:id,status:"processing",outputId:output._id,before:Object.keys(counts).map(itemId=>actor.items.get(itemId).toObject())};
    await actor.setFlag(ID,"transaction",transaction);
    try {
      await saveRequest({...request,status:"processing"});
      await actor.createEmbeddedDocuments("Item",[output],{keepId:true});
      await actor.updateEmbeddedDocuments("Item",Object.entries(counts).map(([itemId,qty])=>({_id:itemId,"system.quantity":actor.items.get(itemId).system.quantity-qty})));
      await actor.setFlag(ID,"transaction",{...transaction,status:"completed"});
    }catch(error){
      let restored=false;
      try{await rollback(actor,transaction);restored=true;}catch(restoreError){console.error(`${ID} | Restauração pendente`,restoreError);}
      await saveRequest({...request,status:restored?"pending":"recovery",error:String(error.message)});
      throw new Error(restored ? `A fabricação falhou; os materiais foram restaurados. ${error.message}` : "A fabricação foi interrompida. Use Restaurar materiais antes de tentar novamente.");
    }
    await saveRequest({...request,status:"completed",outputId:output._id,resolvedAt:Date.now(),resolvedBy:game.user.id});
    await notifyResult(request,actor,"aprovado e concluído");
  });
}
async function notifyResult(request,actor,status) {
  try{
    await ChatMessage.create({content:`<p><strong>Selos de Drakkenheim:</strong> pedido de ${escapeHTML(getRecipe(request.recipeId)?.name ?? "fabricação")} de ${escapeHTML(actor.name)} ${status}.</p>`,whisper:[...new Set([...game.users.filter(u=>u.isGM).map(u=>u.id),request.submittedBy])],speaker:ChatMessage.getSpeaker({actor})});
  }catch(error){console.warn(`${ID} | Resultado salvo; não foi possível publicar o aviso no chat.`,error);}
}
