import {ID,assert,drawStudyRecipes,studyCandidates,escapeHTML as e} from "./core.mjs";
import {components,knownRecipes,recipes,owns} from "./catalog.mjs";
import {serialize,isAuthority,requireGM,announceDiscoveries} from "./service.mjs";

export const studyRequests=()=>game.settings.get(ID,"studyRequests")??[];
const validIds=ids=>Array.isArray(ids)&&ids.length>0&&ids.length<=50&&ids.every(id=>typeof id==="string"&&id.length>0&&id.length<=100)&&new Set(ids).size===ids.length;
async function save(request){
  const list=structuredClone(studyRequests()),at=list.findIndex(row=>row.id===request.id);
  if(at<0)list.push(request);else list[at]=request;
  await game.settings.set(ID,"studyRequests",list);Hooks.callAll(`${ID}.updated`);return request;
}
export async function submitStudyRequest(actor,itemIds){
  assert(actor?.documentName==="Actor"&&actor.type==="character"&&owns(actor),"Selecione um personagem que você controla.");
  assert(validIds(itemIds),"Selecione de 1 a 50 componentes diferentes. As receitas serão sorteadas após a aprovação.");
  assert(!studyRequests().some(row=>row.actorUuid===actor.uuid&&row.status==="pending"),"Este personagem já tem um pedido de estudo aguardando o mestre.");
  const inventory=components(actor),known=knownRecipes(actor).map(row=>row.id),all=recipes();
  for(const id of itemIds){const item=inventory.find(row=>row.id===id);assert(item,"O componente foi removido ou não está mais disponível.");assert(studyCandidates(item,all,known).length,"Um dos componentes não pode revelar uma receita inédita compatível.");}
  const gmIds=game.users.filter(user=>user.isGM).map(user=>user.id);assert(gmIds.length,"É necessário haver um mestre cadastrado no mundo.");
  const request={id:foundry.utils.randomID(),actorUuid:actor.uuid,itemIds:[...itemIds],status:"pending"};
  await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),whisper:[...new Set([game.user.id,...gmIds])],content:`<div class="selos-chat"><h3>Pedido de estudo</h3><p><strong>${e(actor.name)}</strong> quer estudar ${itemIds.length} componente(s) fora do descanso longo.</p><ul>${itemIds.map(id=>`<li>${e(inventory.find(item=>item.id===id).name)}</li>`).join("")}</ul><p>A receita será sorteada somente após a aprovação.</p><button type="button" data-selos-study-review="${request.id}">Revisar estudo</button></div>`,flags:{[ID]:{kind:"study-request",studyRequest:request}}});
  return request;
}
export function ingestStudyMessage(message){
  if(!isAuthority()||message.getFlag(ID,"kind")!=="study-request")return Promise.resolve();
  return serialize(async()=>{
    const data=message.getFlag(ID,"studyRequest");
    if(!/^[A-Za-z0-9]{16}$/.test(data?.id??"")||!validIds(data.itemIds)||studyRequests().some(row=>row.id===data.id))return;
    const actor=await fromUuid(data.actorUuid);
    if(actor?.documentName!=="Actor"||actor.type!=="character"||!message.author||!owns(actor,message.author))return;
    const inventory=components(actor);
    await save({id:data.id,actorUuid:actor.uuid,itemIds:[...data.itemIds],materials:data.itemIds.map(id=>({id,name:inventory.find(item=>item.id===id)?.name??"Componente indisponível"})),submittedBy:message.author.id,submittedAt:message.timestamp,messageId:message.id,status:"pending"});
    ui.notifications.info(`Novo pedido de estudo: ${actor.name}.`);
  });
}
export function resolveStudyRequest(id,{approve}={}){
  return serialize(async()=>{
    requireGM();const request=studyRequests().find(row=>row.id===id);
    assert(request?.status==="pending","Este pedido de estudo já foi processado.");
    const actor=await fromUuid(request.actorUuid);assert(actor?.documentName==="Actor"&&actor.type==="character","O personagem deste pedido foi removido.");
    // The receipt and recipes are saved in one update, so interrupted approvals cannot reroll.
    let result=actor.getFlag(ID,"studyApprovals")?.[id];
    if(!approve&&!result)return save({...request,status:"rejected",resolvedBy:game.user.id,resolvedAt:Date.now()});
    if(!result){
      const user=game.users.get(request.submittedBy);assert(user&&owns(actor,user),"O solicitante não controla mais este personagem.");
      const inventory=components(actor),items=request.itemIds.map(itemId=>inventory.find(item=>item.id===itemId));
      assert(items.every(Boolean),"Um componente foi removido ou não está mais disponível. Recuse o pedido para refazê-lo.");
      const current=knownRecipes(actor),draws=drawStudyRecipes(items,recipes(),current.map(row=>row.id));
      const learned=draws.map(draw=>({id:draw.recipeId,componentId:draw.itemId,componentName:items.find(item=>item.id===draw.itemId).name,source:"Estudo aprovado pelo mestre",learnedAt:Date.now()}));
      result={learned,unavailable:items.filter(item=>!draws.some(draw=>draw.itemId===item.id)).map(item=>({itemId:item.id,name:item.name}))};
      await actor.update({[`flags.${ID}.recipes`]:[...current,...learned],[`flags.${ID}.studyApprovals`]:{...(actor.getFlag(ID,"studyApprovals")??{}),[id]:result}});
    }
    const completed=await save({...request,status:"completed",result,resolvedBy:game.user.id,resolvedAt:Date.now()});
    const chatError=await announceDiscoveries(actor,result.learned,{studyRequestId:id});
    if(chatError)ui.notifications.warn(chatError);
    return completed;
  });
}
export async function rescanStudyRequests(){
  if(!isAuthority())return;
  for(const message of game.messages.contents)await ingestStudyMessage(message);
  for(const request of studyRequests().filter(row=>row.status==="pending")){
    const actor=await fromUuid(request.actorUuid);
    if(actor?.getFlag(ID,"studyApprovals")?.[request.id])await resolveStudyRequest(request.id,{approve:true});
  }
}
