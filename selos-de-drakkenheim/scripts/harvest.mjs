import {ID,RARITIES,TYPES,assert,normalize,rarityFromCR,componentData,requireHarvestTools} from "./core.mjs";
import {catalog,monsterFromActor,componentImage,owns,primaryGM} from "./catalog.mjs";
import {serialize,isAuthority} from "./service.mjs";

export const partKey=part=>`${part.category}:${normalize(part.part)}`;
export function isDefeatedEnemy(token) {
  const hp=token?.actor?.system?.attributes?.hp?.value;
  return token?.documentName==="Token" && token.actor?.type==="npc" && token.disposition===-1 && hp!==null && hp!==undefined && hp!=="" && Number.isFinite(Number(hp)) && Number(hp)===0;
}
export function harvestDestination(user=game.user,controlled=globalThis.canvas?.tokens?.controlled??[]) {
  const controlledActors=[...new Map(controlled.map(token=>token.actor).filter(actor=>actor?.type==="character" && owns(actor,user)).map(actor=>[actor.uuid,actor])).values()];
  if(controlledActors.length===1)return controlledActors[0];
  if(controlledActors.length>1)return null;
  if(user.character?.type==="character" && owns(user.character,user))return user.character;
  const available=game.actors.filter(actor=>actor.type==="character" && owns(actor,user));
  return available.length===1?available[0]:null;
}
const profileName=value=>normalize(value).replace(/[’']/g,"").replace(/\s+/g," ");
export function harvestProfile(token) {
  if(!token?.actor)return null;
  const base=game.actors.get(token.actorId);
  const explicit=token.getFlag(ID,"harvestMonsterId") ?? token.actor.getFlag(ID,"harvestMonsterId") ?? base?.getFlag(ID,"harvestMonsterId");
  let profile=explicit?catalog.monsters.find(monster=>monster.id===explicit):null;
  // Invalid explicit mappings never silently fall back to a different anatomy.
  if(explicit && !profile)return null;
  if(!profile){
    const names=[token.actor.name,base?.name,token.name].filter(Boolean).map(profileName);
    profile=catalog.monsters.find(monster=>names.includes(profileName(monster.name)));
    if(!profile){
      const stripped=names.map(name=>name.replace(/\s*(?:\(\d+\)|#?\d+)$/,""));
      const matches=catalog.monsters.filter(monster=>stripped.includes(profileName(monster.name)));
      if(matches.length===1)profile=matches[0];
    }
  }
  if(!profile)return null;
  const actual=monsterFromActor(token.actor);
  const actualType=token.actor.system.details?.type?.value??token.actor.system.details?.type;
  const rarity=profile.rarity || rarityFromCR(actual.cr);
  if(!RARITIES[rarity])return null;
  return {...actual,id:profile.id,catalogName:profile.name,rarity,parts:profile.parts??[],type:TYPES[actualType]?actualType:profile.type};
}
export function availableHarvestParts(token) {
  const monster=harvestProfile(token),ledger=token.getFlag(ID,"harvests")??{};
  return monster?.parts.filter(part=>!ledger[partKey(part)] || ledger[partKey(part)].status!=="completed")??[];
}
function validateSource(token,user,destination) {
  assert(isDefeatedEnemy(token),"A coleta exige um inimigo com exatamente 0 PV.");
  assert(!token.hidden || user.isGM,"Esta criatura não está disponível para coleta.");
  assert(!user.viewedScene || user.viewedScene===token.parent?.id,"A criatura não está na cena que você está vendo.");
  assert(destination?.documentName==="Actor" && destination.type==="character" && owns(destination,user),"Você precisa controlar o personagem que receberá o componente.");
}
const pending=new Map();
export function handleHarvestResult(message) {
  if(message.getFlag(ID,"kind")!=="harvest-request")return;
  const request=message.getFlag(ID,"harvestRequest"),result=message.getFlag(ID,"harvestResult");
  if(result)pending.get(request?.id)?.(result);
}
export async function requestTokenHarvest(token,destination,key) {
  validateSource(token,game.user,destination);
  requireHarvestTools(destination);
  assert(primaryGM(),"É necessário um mestre conectado para registrar a coleta automaticamente.");
  const id=foundry.utils.randomID();
  let timer;
  const response=new Promise(resolve=>{
    pending.set(id,resolve);
    timer=setTimeout(()=>resolve({status:"timeout",error:"A coleta ainda não foi confirmada. Confira a conexão com o mestre e o inventário antes de tentar novamente."}),30000);
  });
  try{
    const request={id,tokenUuid:token.uuid,actorUuid:destination.uuid,partKey:key};
    const message=await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:destination}),whisper:[...new Set([game.user.id,...game.users.filter(user=>user.isGM).map(user=>user.id)])],content:"<p>Selos de Drakkenheim: coletando componente da criatura derrotada…</p>",flags:{[ID]:{kind:"harvest-request",harvestRequest:request}}});
    handleHarvestResult(message);
    const result=await response;
    assert(result.status==="completed",result.error??"Não foi possível concluir a coleta.");
    return result;
  }finally{clearTimeout(timer);pending.delete(id);}
}
async function publishResult(message,result) {
  // Never put client-provided text or creature names into unescaped chat HTML.
  await message.update({[`flags.${ID}.harvestResult`]:result,content:result.status==="completed"?"<p>Selos de Drakkenheim: componente coletado e guardado em Monster Harvesting Tools.</p>":"<p>Selos de Drakkenheim: a coleta não foi concluída. Confira o aviso recebido.</p>"});
  return result;
}
function resultFromEntry(entry,part) {
  return {status:"completed",itemId:entry.itemId,actorUuid:entry.actorUuid,componentName:entry.componentName??part?.name??"Componente"};
}
export function ingestHarvestMessage(message) {
  if(!isAuthority() || message.getFlag(ID,"kind")!=="harvest-request")return Promise.resolve();
  return serialize(async()=>{
    if(message.getFlag(ID,"harvestResult"))return;
    const request=message.getFlag(ID,"harvestRequest");
    try{
      assert(/^[A-Za-z0-9]{16}$/.test(request?.id??""),"Pedido de coleta inválido.");
      const token=await fromUuid(request.tokenUuid),destination=await fromUuid(request.actorUuid);
      const user=message.author;
      assert(user,"Solicitante não encontrado.");
      validateSource(token,user,destination);
      let monster=harvestProfile(token),part=monster?.parts.find(part=>partKey(part)===request.partKey);
      assert(part,"Esta parte não está cadastrada como coletável para esta criatura.");
      let ledger=structuredClone(token.getFlag(ID,"harvests")??{}),entry=ledger[request.partKey];
      if(entry?.status==="reserved"){
        const recipient=await fromUuid(entry.actorUuid),existing=recipient?.items.get(entry.itemId);
        if(existing?.getFlag(ID,"harvestRequestId")===entry.requestId){
          entry={...entry,status:"completed"};ledger[request.partKey]=entry;
          await token.setFlag(ID,"harvests",ledger);
        }else{
          // A prior GM session stopped before creating the item. The reservation is safe to retry.
          ledger[request.partKey]={...entry,status:"available"};await token.setFlag(ID,"harvests",ledger);entry=undefined;
        }
      }
      if(entry?.status==="completed"){
        assert(entry.requestId===request.id,"Este componente já foi coletado desta criatura.");
        return await publishResult(message,resultFromEntry(entry,part));
      }
      requireHarvestTools(destination);
      const img=await componentImage(part);
      // Recheck after remote image lookup: the creature may have been healed or removed.
      const liveToken=await fromUuid(request.tokenUuid);
      validateSource(liveToken,user,destination);
      assert(isAuthority(),"O mestre ativo mudou. Aguarde a reconexão para concluir a coleta.");
      monster=harvestProfile(liveToken);part=monster?.parts.find(part=>partKey(part)===request.partKey);
      assert(part,"Os componentes disponíveis desta criatura foram alterados.");
      const item=componentData({monster,part,rarity:monster.rarity,quantity:1,weight:.5,img,portrait:token.actor.img,origin:token.uuid});
      item.system.container=requireHarvestTools(destination).id;
      item._id=request.id;
      Object.assign(item.flags[ID],{sourceTokenUuid:token.uuid,harvestRequestId:request.id});
      const reservation={requestId:request.id,itemId:item._id,actorUuid:destination.uuid,userId:user.id,componentName:item.name,status:"reserved",createdAt:Date.now()};
      ledger[request.partKey]=reservation;
      await token.setFlag(ID,"harvests",ledger);
      try{
        // An item already created before a connection failure is reused, never duplicated.
        const existing=destination.items.get(item._id);
        assert(!existing || existing.getFlag(ID,"harvestRequestId")===request.id,"O identificador do item já está em uso.");
        if(!existing){
          // The tools may have been removed while the corpse reservation was saved.
          item.system.container=requireHarvestTools(destination).id;
          await destination.createEmbeddedDocuments("Item",[item],{keepId:true});
        }
      }catch(error){
        const existing=destination.items.get(item._id);
        if(existing?.getFlag(ID,"harvestRequestId")!==request.id){
          ledger[request.partKey]={...reservation,status:"available"};await token.setFlag(ID,"harvests",ledger);throw error;
        }
      }
      ledger[request.partKey]={...reservation,status:"completed"};
      await token.setFlag(ID,"harvests",ledger);
      return await publishResult(message,resultFromEntry(ledger[request.partKey],part));
    }catch(error){
      const recipient=request?.actorUuid?await fromUuid(request.actorUuid):null;
      const existing=recipient?.items?.get(request?.id);
      if(existing?.getFlag(ID,"harvestRequestId")===request?.id && existing?.getFlag(ID,"sourceTokenUuid")===request?.tokenUuid && message.author && owns(recipient,message.author))return await publishResult(message,{status:"completed",itemId:existing.id,actorUuid:recipient.uuid,componentName:existing.name});
      console.warn(`${ID} | Coleta não concluída`,error.message);
      return await publishResult(message,{status:"failed",error:error.message});
    }
  });
}
export async function rescanHarvestRequests() {
  if(!isAuthority())return;
  for(const message of game.messages.contents)if(message.getFlag(ID,"kind")==="harvest-request" && !message.getFlag(ID,"harvestResult"))await ingestHarvestMessage(message);
}
