import {ID,studyLimit} from "./core.mjs";
import {loadCatalog,owns,accessibleActors,primaryGM,knownRecipes,getRecipe} from "./catalog.mjs";
import {startRest,ingestMessage,rescanRequests,isAuthority} from "./service.mjs";
import {openBook,openStudy,openReview,refreshBook,run,editComponentTraits} from "./ui.mjs";
import {ingestHarvestMessage,handleHarvestResult,rescanHarvestRequests} from "./harvest.mjs";
import {installTokenMenu,uninstallTokenMenu,openTokenHarvest,configureTokenHarvest} from "./token-menu.mjs";
import {refreshPlayerPanels,refreshLootPanels,closeLootPanels,openStudyReview} from "./player-ui.mjs";
import {ingestStudyMessage,rescanStudyRequests} from "./study-requests.mjs";

import {migrateResultLinks} from "./result-links.mjs";
import {openHarvestConfig} from "./harvest-ui.mjs";

let ready=false;
Hooks.once("init",()=>{
  const register=(key,config)=>game.settings.register(ID,key,{scope:"world",config:false,...config});
  register("studyMode",{name:"Limite de estudo pela Inteligência",hint:"Por padrão, usa o modificador de Inteligência, com mínimo zero. A opção Valor usa a pontuação total. Estudos fora do descanso exigem aprovação do mestre.",config:true,type:String,default:"modifier",choices:{modifier:"Modificador de Inteligência",score:"Valor de Inteligência"}});
  register("promptOnRest",{name:"Perguntar sobre análise após o descanso longo",config:true,type:Boolean,default:true});
  register("requests",{type:Array,default:[]});
  register("studyRequests",{type:Array,default:[]});
  register("recipeResults",{type:Object,default:{}});
  register("recipeImages",{type:Object,default:{}});
  register("customRecipes",{type:Array,default:[]});
  register("componentImages",{type:Object,default:{}});
  register("wikiImageCache",{scope:"client",type:Object,default:{}});
});
Hooks.once("ready",()=>run(async()=>{
  if(game.system.id!=="dnd5e")return;
  await loadCatalog();ready=true;
  await migrateResultLinks();
  game.modules.get(ID).api={openBook,openHarvest:()=>openBook(undefined,"harvest"),openRequests:()=>openBook(undefined,"requests"),openStudy,editComponentTraits,openTokenHarvest,configureTokenHarvest};
  if(canvas.ready)installTokenMenu();
  await rescanRequests();
  await rescanStudyRequests();
  await rescanHarvestRequests();
}));
Hooks.on("canvasReady",()=>{if(ready)installTokenMenu();});
Hooks.on("canvasTearDown",uninstallTokenMenu);
Hooks.on("getSceneControlButtons",controls=>{
  if(game.system.id!=="dnd5e" || !controls.tokens)return;
  controls.tokens.tools.selosBook={name:"selosBook",title:"Selos de Drakkenheim: receitas e fabricação",icon:"fa-solid fa-book-skull",button:true,order:95,onChange:()=>run(()=>{if(ready)openBook(canvas.tokens.controlled[0]?.actor ?? game.user.character);})};
  if(game.user.isGM)controls.tokens.tools.selosHarvest={name:"selosHarvest",title:"Selos de Drakkenheim: coletar componentes",icon:"fa-solid fa-paw",button:true,order:96,onChange:()=>{if(ready)openBook(undefined,"harvest");}};
});
Hooks.on("getHeaderControlsApplicationV2",(application,controls)=>{
  const actor=application.document ?? application.actor;
  if(!ready)return;
  if(application.isPrototype&&application.actor?.type==="npc"&&game.user.isGM){
    controls.push({label:"Configurar componentes",icon:"fa-solid fa-screwdriver-wrench",action:"selosPrototypeComponents",onClick:()=>run(()=>openHarvestConfig(application.actor,{prototype:true,sourceApplication:application}))});return;
  }
  if(actor?.documentName==="Token" && game.user.isGM && actor.actor?.type==="npc"){
    controls.push({label:"Configurar componentes",icon:"fa-solid fa-paw",action:"selosTokenComponents",onClick:()=>run(()=>configureTokenHarvest(actor,{sourceApplication:application}))});return;
  }
  if(actor?.documentName==="Item" && game.user.isGM && actor.getFlag(ID,"kind")==="component"){
    controls.push({label:"Conferir origem do componente",icon:"fa-solid fa-paw",action:"selosComponentSource",onClick:()=>run(()=>editComponentTraits(actor))});return;
  }
  if(actor?.documentName!=="Actor" || actor.type!=="character" || !owns(actor))return;
  controls.push({label:"Selos de Drakkenheim",icon:"fa-solid fa-book-skull",action:"selosBook",onClick:()=>openBook(actor)});
});
Hooks.on("getItemSheetHeaderButtons",(sheet,buttons)=>{
  if(!ready || !game.user.isGM || sheet.item?.getFlag(ID,"kind")!=="component")return;
  buttons.unshift({label:"Origem",class:"selos-component-source",icon:"fa-solid fa-paw",onclick:()=>run(()=>editComponentTraits(sheet.item))});
});
Hooks.on("getActorSheetHeaderButtons",(sheet,buttons)=>{
  if(!ready || sheet.actor?.type!=="character" || !owns(sheet.actor))return;
  buttons.unshift({label:"Receitas",class:"selos-book",icon:"fa-solid fa-book-skull",onclick:()=>openBook(sheet.actor)});
});
function injectSheet(sheet,html){
  const actor=sheet.actor ?? sheet.document,root=html instanceof HTMLElement?html:html?.[0];
  if(!ready || actor?.documentName!=="Actor" || actor.type!=="character" || !owns(actor) || !root)return;
  root.querySelectorAll(".selos-sheet-section").forEach(el=>el.remove());
  const target=root.querySelector('.tab[data-tab="inventory"]') ?? root.querySelector('.inventory') ?? root.querySelector('.sheet-body');
  if(!target)return;
  const section=document.createElement("section");section.className="selos-sheet-section";
  const list=knownRecipes(actor);
  const button=document.createElement("button");button.type="button";button.innerHTML='<i class="fa-solid fa-book-skull" aria-hidden="true"></i> Selos de Drakkenheim';button.addEventListener("click",()=>openBook(actor));
  const text=document.createElement("p");text.textContent=list.length?`${list.length} receita(s) conhecida(s): ${list.map(r=>getRecipe(r.id)?.name??"Receita indisponível").join(", ")}.`:"Nenhuma receita aprendida. Analise componentes após um descanso longo.";
  section.append(button,text);target.append(section);
}
Hooks.on("renderActorSheetV2",injectSheet);
Hooks.on("renderActorSheet",injectSheet);
function injectDirectory(_application,html){
  if(!ready)return;
  const root=html instanceof HTMLElement?html:html?.[0];if(!root || root.querySelector(".selos-directory-button"))return;
  const target=root.querySelector(".header-actions") ?? root.querySelector(".directory-header") ?? root;
  const button=document.createElement("button");button.type="button";button.className="selos-directory-button";button.innerHTML='<i class="fa-solid fa-book-skull" aria-hidden="true"></i> Selos de Drakkenheim';button.addEventListener("click",()=>openBook(undefined,game.user.isGM?"harvest":"book"));target.append(button);
}
Hooks.on("renderItemDirectory",injectDirectory);
Hooks.on("dnd5e.restCompleted",(actor,result,config)=>run(async()=>{
  if(!ready || actor.type!=="character" || !owns(actor) || (config?.type ?? result.type)!=="long")return;
  const restId=result.message?.uuid ?? foundry.utils.randomID();
  await startRest(actor,restId);
  if(!game.settings.get(ID,"promptOnRest") || studyLimit(actor,game.settings.get(ID,"studyMode"))===0)return;
  const recipient=game.user.isGM?game.users.find(user=>user.active&&!user.isGM&&owns(actor,user)):game.user;
  if(recipient && recipient.id!==game.user.id){
    await ChatMessage.create({content:`<p>Descanso longo concluído. Deseja analisar componentes para aprender receitas?</p><button type="button" data-selos-study="${actor.uuid}">Analisar componentes</button>`,whisper:[recipient.id,game.user.id],speaker:ChatMessage.getSpeaker({actor}),flags:{[ID]:{kind:"study-offer",actorUuid:actor.uuid,restId,recipient:recipient.id}}});
  }else await openStudy(actor,{restId});
}));
Hooks.on("createChatMessage",message=>run(async()=>{
  if(!ready)return;
  await ingestHarvestMessage(message);
  handleHarvestResult(message);
  await ingestMessage(message);
  await ingestStudyMessage(message);
  if(message.getFlag(ID,"kind")==="study-offer" && message.getFlag(ID,"recipient")===game.user.id){
    const actor=await fromUuid(message.getFlag(ID,"actorUuid"));
    if(actor && owns(actor) && actor.getFlag(ID,"study")?.restId===message.getFlag(ID,"restId"))await openStudy(actor,{restId:message.getFlag(ID,"restId")});
  }
}));
Hooks.on("renderChatMessageHTML",(message,html)=>{
  const root=html instanceof HTMLElement?html:html?.[0];if(!root)return;
  root.querySelectorAll("[data-selos-request]").forEach(button=>{
    button.hidden=!game.user.isGM;button.addEventListener("click",()=>run(async()=>{await ingestMessage(message);await openReview(button.dataset.selosRequest);}));
  });
  root.querySelectorAll("[data-selos-study-review]").forEach(button=>{button.hidden=!game.user.isGM;button.addEventListener("click",()=>run(async()=>{await ingestStudyMessage(message);openStudyReview(button.dataset.selosStudyReview);}));});
  root.querySelectorAll("[data-selos-study]").forEach(button=>button.addEventListener("click",()=>run(async()=>{const actor=await fromUuid(button.dataset.selosStudy);if(!actor || actor.getFlag(ID,"study")?.restId!==message.getFlag(ID,"restId"))throw new Error("Este convite pertence a um descanso anterior.");await openStudy(actor,{restId:message.getFlag(ID,"restId")});})));
});
Hooks.on("updateChatMessage",message=>{if(ready)handleHarvestResult(message);});
Hooks.on("userConnected",()=>{if(ready && isAuthority())run(async()=>{await rescanRequests();await rescanHarvestRequests();await rescanStudyRequests();});});
Hooks.on(`${ID}.updated`,refreshBook);
Hooks.on("updateActor",actor=>{if(ready)refreshBook(actor);});
for(const event of ["createItem","updateItem","deleteItem"])Hooks.on(event,item=>{if(ready&&item.parent?.documentName==="Actor")refreshPlayerPanels(item.parent);});
Hooks.on("updateToken",token=>{if(ready)refreshLootPanels(token);});
Hooks.on("deleteToken",token=>{if(ready)closeLootPanels(token);});
Hooks.on("updateSetting",setting=>{if(ready&&setting.key?.startsWith(`${ID}.`))refreshPlayerPanels();});
