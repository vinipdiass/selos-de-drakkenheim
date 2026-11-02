import {ID,RARITIES,CATEGORIES,TYPES,escapeHTML as e,safeImage,normalize,recipeSlots,studyCandidates,workshopMeets,harvestTools,HARVEST_TOOLS_NAME,HARVEST_TOOLS_REQUIRED} from "./core.mjs";
import {catalog,recipes,getRecipe,components,knownRecipes,accessibleActors,owns,componentPreview} from "./catalog.mjs";
import {studyComponents,submitRequest,requests,serialize,revokeRecipe,setRecipeImage} from "./service.mjs";
import {harvestDestination,harvestProfile,isDefeatedEnemy,partKey,requestTokenHarvest} from "./harvest.mjs";
import {CraftingPlan,resolveInventoryDrop} from "./crafting.mjs";

const {ApplicationV2}=foundry.applications.api;
const panels=new Set(),colors={common:"#cfc5b6",uncommon:"#8fd0a1",rare:"#91b8f1",veryRare:"#c4a2ef",legendary:"#edc577"};
const icon=(name,extra="")=>`<i class="fa-solid ${name}" aria-hidden="true" ${extra}></i>`;
const action=(name,label,glyph="",attrs="")=>`<button type="button" data-game-action="${name}" ${attrs}>${glyph?icon(glyph):""}<span>${e(label)}</span></button>`;
const rarityBadge=rarity=>`<span class="sd-rarity" style="--rarity:${colors[rarity]??colors.veryRare}">${e(RARITIES[rarity]??"Variável")}</span>`;
const picture=(src,alt,fallback="icons/svg/item-bag.svg",cls="")=>`<img class="${cls}" src="${e(safeImage(src,fallback))}" alt="${e(alt)}" data-fallback="${e(fallback)}" loading="lazy" draggable="false">`;
const categoryGlyph={animus:"fa-fire-flame-curved",bones:"fa-bone",dust:"fa-wand-sparkles",fluid:"fa-droplet",hair:"fa-feather",hide:"fa-shield-halved",natural:"fa-paw",organs:"fa-heart"};
const recipeGlyph=recipe=>({Arma:"fa-sword",Armadura:"fa-shield-halved",Poção:"fa-flask",Pergaminho:"fa-scroll",Anel:"fa-ring",Varinha:"fa-wand-sparkles"}[recipe.category]??"fa-gem");
const recipeArt=recipe=>recipe?.img?picture(recipe.img,recipe.name,"icons/svg/book.svg"):icon(recipeGlyph(recipe??{}));
function recipeCrest(recipe){
  const art=recipeArt(recipe);
  return game.user.isGM?`<button type="button" class="sd-recipe-crest sd-edit-recipe-icon" data-game-action="edit-recipe-icon" data-recipe-id="${e(recipe.id)}" title="${e(`Alterar o ícone de ${recipe.name} para todos os personagens`)}" aria-label="${e(`Alterar ícone global de ${recipe.name}`)}">${art}<span class="sd-icon-edit-mark">${icon("fa-pen")}</span></button>`:`<div class="sd-recipe-crest">${art}</div>`;
}
const itemImage=item=>safeImage(item.img,componentPreview(item.flags?.[ID]??{}).src);
function slotName(slot){
  return slot.alternatives.map(alternative=>{
    if(alternative.part==="any")return CATEGORIES[slot.category];
    const aliases={"aberration dust":"Aberrant Dust","dragon dust":"Draconic Dust"};
    const key=aliases[alternative.part]??Object.keys(catalog.translations).find(key=>normalize(key)===alternative.part);
    return catalog.translations[key]??CATEGORIES[slot.category];
  }).filter((value,index,array)=>array.indexOf(value)===index).join(" ou ");
}
function materialTile(item,{actionName="material",remaining=item.system.quantity,selected=false,disabled=false,subtitle="",draggable=false}={}){
  const component=item.flags[ID],preview=componentPreview(component);
  return `<button type="button" class="sd-material ${selected?"is-selected":""}" style="--rarity:${colors[component.rarity]??colors.common}" data-game-action="${actionName}" data-item-id="${e(item.id)}" ${draggable&&remaining>0?`draggable="true" data-drag-item="${e(item.id)}"`:""} ${disabled?"disabled":""} ${actionName==="toggle-study"?`aria-pressed="${selected}"`:""} title="${e(`${item.name}\n${CATEGORIES[component.category]} · ${RARITIES[component.rarity]}${subtitle?`\n${subtitle}`:""}`)}"><span class="sd-item-art">${picture(itemImage(item),"",preview.fallback)}<span class="sd-quantity">${remaining>0?`×${remaining}`:"Reservado"}</span>${selected?`<span class="sd-check">${icon("fa-check")}</span>`:""}</span><strong>${e(item.name.split(" | ")[0])}</strong><small>${e(subtitle||CATEGORIES[component.category])}</small></button>`;
}
function heroHeader({eyebrow,title,subtitle,portrait,portraitFallback="icons/svg/mystery-man.svg",glyph="fa-book-skull",rarity,side=""}){
  return `<header class="sd-hero"><div class="sd-hero-art">${portrait?picture(portrait,"Retrato",portraitFallback):icon(glyph)}</div><div class="sd-hero-copy"><span class="sd-eyebrow">${e(eyebrow)}</span><h1>${e(title)}</h1><p>${e(subtitle??"")}</p>${rarity?rarityBadge(rarity):""}</div>${side?`<div class="sd-hero-side">${side}</div>`:""}</header>`;
}
function emptyState(glyph,title,text){return `<div class="sd-empty"><span>${icon(glyph)}</span><h2>${e(title)}</h2><p>${e(text)}</p></div>`;}
const errorText=error=>error.message??String(error);

export async function editRecipeIcon(recipeId){
  if(!game.user.isGM)throw new Error("Somente o mestre pode alterar o ícone global de uma receita.");
  const recipe=getRecipe(recipeId);if(!recipe)throw new Error("Receita não encontrada.");
  const {DialogV2}=foundry.applications.api;
  const result=await DialogV2.wait({window:{title:`Ícone global — ${recipe.name}`},classes:["selos-icon-dialog"],position:{width:540},modal:false,content:`<div class="selos-recipe-icon-editor"><p>O ícone de <strong>${e(recipe.name)}</strong> será alterado para <strong>todos os personagens deste mundo</strong>.</p><div class="selos-icon-preview"><img data-icon-preview src="${e(recipe.img||"icons/svg/book.svg")}" alt="Prévia do ícone" ${recipe.img?"":"hidden"}><i data-icon-default class="fa-solid ${recipeGlyph(recipe)}" ${recipe.img?"hidden":""} aria-hidden="true"></i></div><label class="selos-field"><span>Imagem (caminho ou URL)</span><input type="text" name="recipeIconPath" value="${e(recipe.img)}" maxlength="2048" placeholder="icons/… ou https://…"></label><button type="button" data-browse-recipe-icon><i class="fa-solid fa-folder-open" aria-hidden="true"></i> Escolher arquivo</button><p class="selos-note">Escolha uma imagem acessível aos jogadores. Em branco: usar o ícone padrão da categoria.</p></div>`,buttons:[{action:"save",label:"Salvar para todos",callback:(_event,_button,dialog)=>({path:dialog.element.querySelector('[name="recipeIconPath"]').value})},{action:"reset",label:"Usar ícone padrão",callback:()=>({path:""})},{action:"cancel",label:"Cancelar",callback:()=>null}],rejectClose:false,render:(_event,dialog)=>{
    const root=dialog.element,input=root.querySelector('[name="recipeIconPath"]'),preview=root.querySelector('[data-icon-preview]'),fallback=root.querySelector('[data-icon-default]');
    const updatePreview=()=>{const path=safeImage(input.value,"");preview.hidden=!path;fallback.hidden=!!path;if(path)preview.src=path;};
    preview.addEventListener("error",()=>{preview.hidden=true;fallback.hidden=false;});input.addEventListener("input",updatePreview);
    root.querySelector('[data-browse-recipe-icon]').addEventListener("click",()=>{
      try{
        const FilePicker=foundry.applications.apps.FilePicker.implementation;
        Promise.resolve(new FilePicker({type:"image",current:input.value,callback:path=>{if(!root.isConnected)return;input.value=path;updatePreview();}}).render({force:true})).catch(error=>ui.notifications.error(errorText(error)));
      }catch(error){ui.notifications.error(errorText(error));}
    });
  }});
  if(!result)return;
  await setRecipeImage(recipeId,result.path);
  await refreshPlayerPanels();
  ui.notifications.info(`Ícone de ${recipe.name} atualizado para todos os personagens.`);
}

export class GamePanel extends ApplicationV2{
  static DEFAULT_OPTIONS={classes:["selos-game"],window:{title:"Selos de Drakkenheim",icon:"fa-solid fa-book-skull",resizable:true},position:{width:960,height:760}};
  constructor(){super();this.notice="";panels.add(this);}
  _replaceHTML(result,content){content.innerHTML=result;}
  async _onRender(context,options){
    await super._onRender(context,options);
    this.element.dataset.selosPanel=this.kind;
    this.events?.abort();this.events=new AbortController();const signal=this.events.signal;
    this.element.addEventListener("error",event=>{const img=event.target;if(img instanceof HTMLImageElement && img.dataset.fallback){const fallback=img.dataset.fallback;delete img.dataset.fallback;img.src=fallback;}},{capture:true,signal});
    this.element.addEventListener("click",event=>{
      const target=event.target.closest("[data-game-action]");if(!target)return;event.preventDefault();
      Promise.resolve().then(()=>this.onAction(target.dataset.gameAction,target)).catch(error=>this.feedback(errorText(error)));
    },{signal});
    this.element.addEventListener("input",event=>this.onInput(event),{signal});
    this.element.addEventListener("change",event=>this.onChange(event),{signal});
    this.element.addEventListener("dragstart",event=>{
      const target=event.target.closest("[data-drag-item]");if(!target)return;
      const item=this.actor?.items.get(target.dataset.dragItem);if(!item)return;
      event.dataTransfer.setData("text/plain",JSON.stringify({type:"Item",uuid:item.uuid??`${this.actor.uuid}.Item.${item.id}`}));event.dataTransfer.effectAllowed="copy";
    },{signal});
    this.bindEvents?.(signal);
  }
  async _onClose(options){this.closed=true;this.events?.abort();panels.delete(this);await super._onClose?.(options);}
  redraw({activate=false}={}){
    this.drawing=(this.drawing??Promise.resolve()).then(async()=>{
      if(this.closed)return this;
      await this.render({force:!this.rendered});
      // ApplicationV2 has no element until its first asynchronous render finishes.
      if(activate&&this.rendered&&!this.closed)this.bringToFront();
      return this;
    }).catch(error=>ui.notifications.error(errorText(error)));
    return this.drawing;
  }
  feedback(text){this.notice=text;const live=this.element?.querySelector(".sd-feedback");if(live){live.textContent=text;live.hidden=!text;}else ui.notifications.warn(text);}
  feedbackHTML(){return `<p class="sd-feedback" aria-live="polite" ${this.notice?"":"hidden"}>${e(this.notice)}</p>`;}
  onInput(){}onChange(){}
  async onAction(action){if(action==="close")return this.close();if(action==="sheet")return this.actor?.sheet?.render({force:true});if(action==="book"){const panel=openPlayerBook(this.actor);if(this.kind!=="book")await this.close();return panel;}}
}

class PlayerBook extends GamePanel{
  constructor(actor){super();this.kind="book";this.actor=actor;this.tab="recipes";this.query="";this.rarity="";}
  async _renderHTML(){
    const actor=this.actor,known=knownRecipes(actor),items=components(actor),study=actor.getFlag(ID,"study"),remaining=study?Math.max(0,study.limit-study.used.length):0;
    const choices=accessibleActors();if(!choices.some(a=>a.uuid===actor.uuid))choices.push(actor);
    const select=choices.length>1?`<select name="playerActor" aria-label="Personagem">${choices.map(a=>`<option value="${e(a.uuid)}" ${actor.uuid===a.uuid?"selected":""}>${e(a.name)}</option>`).join("")}</select>`:"";
    const header=heroHeader({eyebrow:"Selos de Drakkenheim",title:"Grimório do caçador",subtitle:actor.name,portrait:actor.img,side:`${select}<span class="sd-stat"><strong>${known.length}</strong> receitas conhecidas</span>`});
    const tabs=`<nav class="sd-tabs" aria-label="Grimório">${action("recipes","Receitas","fa-book-open",`aria-pressed="${this.tab==="recipes"}"`)}${action("materials","Materiais","fa-sack-xmark",`aria-pressed="${this.tab==="materials"}"`)}${action("study",`Estudar${remaining?` · ${remaining}`:""}`,"fa-moon",`${remaining?"":"disabled"} title="${study?"Analisar os materiais deste descanso":"Conclua um descanso longo para estudar"}"`)}${game.user.isGM?action("gm-catalogue","Catálogo do mestre","fa-scroll")+action("gm-requests","Pedidos","fa-hourglass-half"):""}${action("sheet","Abrir ficha","fa-user")}</nav>`;
    const cards=recipes().filter(recipe=>known.some(entry=>entry.id===recipe.id));
    const bank=items.length?`<div class="sd-material-grid">${items.map(item=>materialTile(item,{actionName:"inspect",draggable:true})).join("")}</div>`:emptyState("fa-paw","Sua bolsa está vazia","Procure componentes em criaturas derrotadas. Clique com o botão direito no token de um inimigo com 0 PV.");
    const list=cards.length?`<div class="sd-recipe-grid">${cards.map(recipe=>{
      const total=recipeSlots(recipe).length,pending=requests().find(request=>request.actorUuid===actor.uuid&&request.recipeId===recipe.id&&["pending","processing","recovery"].includes(request.status));
      return `<article class="sd-recipe-card" data-search="${e(normalize(`${recipe.name} ${recipe.originalName}`))}" data-rarity="${recipe.rarity}" style="--rarity:${colors[recipe.rarity]??colors.veryRare}">${recipeCrest(recipe)}${rarityBadge(recipe.rarity)}<h2>${e(recipe.name)}</h2><p>${e(recipe.category)} <span>· ${total} componentes</span></p><details><summary>Ver receita</summary><ul>${recipe.requirements.map(requirement=>`<li>${e(requirement.label)}</li>`).join("")}</ul>${recipe.attunement?`<p>${e(recipe.attunement)}</p>`:""}${recipe.other?`<p>${e(recipe.other)}</p>`:""}</details>${action("forge",pending?"Ver pedido":"Abrir bancada",pending?"fa-hourglass-half":"fa-hammer",`data-recipe-id="${recipe.id}"`)}${game.user.isGM?action("remove-recipe","Remover receita","fa-trash-can",`class="sd-forget-recipe" data-recipe-id="${e(recipe.id)}" aria-label="${e(`Remover ${recipe.name} do grimório de ${actor.name}`)}"`):""}</article>`;
    }).join("")}</div><p class="sd-no-results" hidden>Nenhuma receita corresponde à pesquisa.</p>`:emptyState("fa-book-open","Todo grimório começa em branco","Estude os componentes durante um descanso longo para descobrir receitas. O mestre também pode ensinar uma receita ao personagem.");
    return `${header}${tabs}<div class="sd-book-layout"><main class="sd-main"><div class="sd-section-heading"><div><span class="sd-eyebrow">${this.tab==="recipes"?"Conhecimento conquistado":"Coletas da jornada"}</span><h2>${this.tab==="recipes"?"Suas receitas":"Seus componentes"}</h2></div><span class="sd-count">${this.tab==="recipes"?cards.length:items.length}</span></div>${this.tab==="recipes"?`<div class="sd-search"><input type="search" name="recipeSearch" value="${e(this.query)}" placeholder="Buscar no grimório…" aria-label="Buscar receita"><select name="recipeRarity" aria-label="Raridade da receita"><option value="">Todas as raridades</option>${Object.entries({...RARITIES,varies:"Variável"}).map(([key,label])=>`<option value="${key}" ${key===this.rarity?"selected":""}>${label}</option>`).join("")}</select></div>${list}`:bank}${this.feedbackHTML()}</main><aside class="sd-book-aside"><div class="sd-rest-card">${icon("fa-moon")}<span class="sd-eyebrow">Estudo no descanso</span><strong>${study?`${remaining} análise(s) disponível(is)`:"Descanse para descobrir"}</strong><p>Escolha o material. A descoberta será uma receita inédita, sorteada entre as compatíveis.</p>${action("study","Analisar componentes","fa-magnifying-glass",remaining?"":"disabled")}</div><div class="sd-aside-heading"><h3>Bolsa de componentes</h3><span>${items.length}</span></div><p class="sd-muted">Arraste estes materiais para a bancada de uma receita.</p><div class="sd-bag-grid">${items.map(item=>materialTile(item,{actionName:"inspect",draggable:true})).join("")||'<p class="sd-muted">Nenhum componente coletado.</p>'}</div></aside></div>`;
  }
  async _onRender(context,options){await super._onRender(context,options);this.filter();}
  filter(){let visible=0;this.element.querySelectorAll(".sd-recipe-card").forEach(card=>{card.hidden=!card.dataset.search.includes(normalize(this.query))||!!this.rarity&&card.dataset.rarity!==this.rarity;if(!card.hidden)visible++;});const empty=this.element.querySelector(".sd-no-results");if(empty)empty.hidden=visible>0;}
  onInput(event){if(event.target.name==="recipeSearch"){this.query=event.target.value;this.filter();}}
  onChange(event){if(event.target.name==="recipeRarity"){this.rarity=event.target.value;this.filter();}if(event.target.name==="playerActor")Promise.resolve(fromUuid(event.target.value)).then(actor=>{if(actor&&owns(actor)){this.actor=actor;this.redraw();}});}
  async onAction(action,target){
    if(action==="recipes"||action==="materials"){this.tab=action;return this.redraw();}
    if(action==="study")return openPlayerStudy(this.actor);
    if(action==="forge")return openForge(this.actor,getRecipe(target.dataset.recipeId));
    if(action==="edit-recipe-icon")return editRecipeIcon(target.dataset.recipeId);
    if(action==="remove-recipe"){
      const actor=this.actor,id=target.dataset.recipeId,name=getRecipe(id)?.name??"Receita";
      target.disabled=true;
      try{
        if(await revokeRecipe(actor,id))ui.notifications.info(`${name}: receita removida do grimório de ${actor.name}.`);
        await refreshPlayerPanels(actor);
      }finally{if(target.isConnected)target.disabled=false;}
      return;
    }
    if((action==="gm-catalogue"||action==="gm-requests")&&game.user.isGM)return game.modules.get(ID).api.openBook(this.actor,action==="gm-catalogue"?"catalogue":"requests");
    if(action==="inspect"){const item=this.actor.items.get(target.dataset.itemId);return item?.sheet?.render({force:true});}
    return super.onAction(action,target);
  }
}

class LootPanel extends GamePanel{
  static DEFAULT_OPTIONS={window:{title:"Coletar componentes"},position:{width:800,height:800}};
  constructor(token,actor){super();this.kind="loot";this.token=token;this.actor=actor;this.filter="";this.collecting=null;}
  async _renderHTML(){
    const monster=harvestProfile(this.token),ledger=this.token.getFlag(ID,"harvests")??{},valid=isDefeatedEnemy(this.token),parts=monster?.parts??[],tools=harvestTools(this.actor);
    const collected=parts.filter(part=>ledger[partKey(part)]?.status==="completed").length;
    const categories=[...new Set(parts.map(part=>part.category))];
    const header=heroHeader({eyebrow:"Espólios da caçada",title:this.token.name??monster?.name??"Criatura",subtitle:`${TYPES[monster?.type]??"Criatura"} · ${collected} de ${parts.length} partes coletadas`,portrait:this.token.actor?.img,rarity:monster?.rarity});
    return `${header}<div class="sd-loot-destination">${icon("fa-sack-xmark")} <span>Destino <strong>${e(this.actor.name)}</strong><small class="sd-loot-container">${e(HARVEST_TOOLS_NAME)}</small></span><span class="sd-loot-progress">${collected}/${parts.length}</span></div><div class="sd-progress"><span style="width:${parts.length?collected/parts.length*100:0}%"></span></div><nav class="sd-category-tabs" aria-label="Categorias de componentes">${action("filter","Todos","",`data-category="" aria-pressed="${!this.filter}"`)}${categories.map(category=>action("filter",CATEGORIES[category],categoryGlyph[category],`data-category="${category}" aria-pressed="${this.filter===category}"`)).join("")}</nav><main class="sd-main">${!valid?'<p class="sd-feedback">Esta criatura não está mais disponível para coleta.</p>':""}${!tools?`<div class="sd-feedback sd-tools-required" role="status"><p>${e(HARVEST_TOOLS_REQUIRED)}</p>${action("sheet","Abrir inventário","fa-sack-xmark")}</div>`:""}<p class="sd-muted">Clique no ícone da parte que deseja coletar.</p><div class="sd-loot-grid">${parts.filter(part=>!this.filter||part.category===this.filter).map(part=>{
      const key=partKey(part),done=ledger[key]?.status==="completed",busy=this.collecting===key,preview=componentPreview(part);
      return `<button type="button" class="sd-loot-tile ${done?"is-collected":""} ${busy?"is-busy":""}" style="--rarity:${colors[monster.rarity]}" data-game-action="collect-part" data-part-key="${e(key)}" ${done||this.collecting||!valid||!tools?"disabled":""} aria-label="${e(`${done?"Já coletado":busy?"Coletando":"Coletar"}: ${part.name}`)}" title="${e(`${part.name}\n${CATEGORIES[part.category]} · ${RARITIES[monster.rarity]}`)}"><span class="sd-loot-art">${picture(preview.src,"",preview.fallback)}${done?`<span class="sd-collected-mark">${icon("fa-check")}</span>`:busy?`<span class="sd-collected-mark sd-spinner">${icon("fa-circle-notch")}</span>`:""}</span><strong>${e(part.name)}</strong><small>${e(CATEGORIES[part.category])}</small><span class="sd-loot-state">${done?"Guardado":busy?"Coletando…":e(RARITIES[monster.rarity])}</span></button>`;
    }).join("")}</div>${this.feedbackHTML()}</main><footer class="sd-footer"><span class="sd-muted">Os componentes vão para ${e(HARVEST_TOOLS_NAME)}. Você pode retirá-los depois.</span>${action("close","Concluir","fa-check")}</footer>`;
  }
  async onAction(action,target){
    if(action==="filter"){this.filter=target.dataset.category;return this.redraw();}
    if(action==="collect-part"){
      if(this.collecting)return;
      this.collecting=target.dataset.partKey;this.notice="";await this.redraw();
      try{const result=await requestTokenHarvest(this.token,this.actor,this.collecting);this.notice=`${result.componentName} guardado em ${HARVEST_TOOLS_NAME} de ${this.actor.name}.`;}
      catch(error){this.notice=errorText(error);}finally{this.collecting=null;await this.redraw();}
      return;
    }
    return super.onAction(action,target);
  }
}

class ForgePanel extends GamePanel{
  static DEFAULT_OPTIONS={window:{title:"Bancada de fabricação"},position:{width:1040,height:800}};
  constructor(actor,recipe){
    super();this.kind="forge";this.actor=actor;this.recipe=recipe;
    this.plan=new CraftingPlan(recipe,components(actor));this.workshop=recipe.workshop==="varies"?this.plan.rarity:recipe.workshop;this.notes="";this.busy=false;
    this.submitted=requests().find(request=>request.actorUuid===actor.uuid&&request.recipeId===recipe.id&&["pending","processing","recovery"].includes(request.status))??null;
  }
  async _renderHTML(){
    const {plan}=this,recipe=getRecipe(this.recipe.id)??this.recipe;plan.setInventory(components(this.actor));
    const header=heroHeader({eyebrow:"Bancada de fabricação",title:recipe.name,subtitle:`${this.actor.name} · ${recipe.category}`,portrait:recipe.img,portraitFallback:"icons/svg/book.svg",glyph:recipeGlyph(recipe),rarity:plan.rarity});
    if(this.submitted){
      const current=requests().find(request=>request.id===this.submitted.id)??this.submitted,completed=current.status==="completed",rejected=current.status==="rejected";
      return `${header}<main class="sd-main sd-submitted">${emptyState(completed?"fa-gem":rejected?"fa-xmark":"fa-hourglass-half",completed?"Seu item foi forjado":rejected?"Pedido recusado":"Pedido enviado ao mestre",completed?"O item fabricado já está no inventário do personagem.":rejected?"O mestre recusou esta fabricação. Seus componentes foram preservados.":"A bancada está registrada. Seus materiais serão consumidos após a aprovação do mestre.")}${this.feedbackHTML()}<div class="sd-center-actions">${action("sheet","Ver inventário","fa-sack-xmark")}${action("book","Voltar ao grimório","fa-book-open")}${action("close","Fechar")}</div></main>`;
    }
    const validation=plan.validation,required=recipe.workshop==="varies"?plan.rarity:recipe.workshop,workshopOkay=workshopMeets(this.workshop,required),ready=validation.ok&&workshopOkay;
    const rarityChoices=recipe.rarity==="varies"?`<div class="sd-rarity-options"><span>Raridade da criação</span>${Object.entries(RARITIES).map(([key,label])=>action("rarity",label,"",`data-rarity="${key}" aria-pressed="${plan.rarity===key}"`)).join("")}</div>`:"";
    const slots=plan.slots.map((slot,index)=>{
      const item=plan.items.find(item=>item.id===plan.assignments[index]),error=item?plan.check(index,item.id):"";
      return `<div class="sd-slot-wrap"><button type="button" class="sd-craft-slot ${item?"is-filled":""} ${error?"is-invalid":""}" data-slot-index="${index}" data-game-action="slot" title="${e(`${slot.label}${error?`\n${error}`:""}`)}" aria-label="${e(`Espaço ${index+1}: ${slotName(slot)}${item?`. ${item.name}`:". Arraste um componente"}`)}"><span class="sd-slot-number">${String(index+1).padStart(2,"0")}</span><span class="sd-slot-art">${item?picture(itemImage(item),"",componentPreview(item.flags[ID]).fallback):icon(categoryGlyph[slot.category])}</span><strong>${e(item?item.name.split(" | ")[0]:slotName(slot))}</strong><small>${item?"Componente encaixado":e(CATEGORIES[slot.category])}</small><span class="sd-slot-hint">${error?e(error):item?"Pronto":`Arraste aqui · ${RARITIES[plan.rarity]}`}</span></button>${item?action("remove","Remover","fa-xmark",`class="sd-remove" data-index="${index}" aria-label="Remover material do espaço ${index+1}"`):""}<details class="sd-slot-requirement"><summary>Requisito</summary><p>${e(slot.label)}</p></details></div>`;
    }).join("");
    return `${header}${rarityChoices}<div class="sd-forge-layout"><main class="sd-main sd-forge-main"><div class="sd-section-heading"><div><span class="sd-eyebrow">Combine os componentes</span><h2>Prepare a bancada</h2></div>${action("clear","Limpar","fa-rotate-left")}</div><div class="sd-forge-meter"><span>${plan.filled}/${plan.slots.length} espaços preenchidos</span><strong>${validation.ok?"Materiais prontos":"Montagem em andamento"}</strong></div><div class="sd-progress"><span style="width:${plan.filled/plan.slots.length*100}%"></span></div><div class="sd-craft-slots">${slots}</div>${recipe.other?`<p class="sd-rule">${icon("fa-circle-info")} ${e(recipe.other)}</p>`:""}<div class="sd-workshop"><span class="sd-eyebrow">Local de fabricação</span><h3>Oficina ${RARITIES[required]}</h3><p class="sd-muted">Selecione a oficina disponível. O mestre confirmará o acesso.</p><div class="sd-workshop-choices">${Object.entries(RARITIES).map(([key,label])=>action("workshop",label,"",`data-rarity="${key}" aria-pressed="${this.workshop===key}"`)).join("")}</div>${!workshopOkay?'<p class="sd-rule">A oficina precisa ter a raridade exigida ou uma superior.</p>':""}<label class="sd-field"><span>Local da oficina ou observações (opcional)</span><textarea name="forgeNotes" rows="2" maxlength="2000" placeholder="Ex.: oficina do santuário">${e(this.notes)}</textarea></label></div>${this.feedbackHTML()}</main><aside class="sd-forge-bag"><div class="sd-section-heading"><div><span class="sd-eyebrow">Inventário de ${e(this.actor.name)}</span><h2>Seus materiais</h2></div>${action("sheet","Ficha","fa-up-right-from-square")}</div><p class="sd-muted">Arraste da bolsa ou da ficha para um espaço. Um clique no material encaixa a primeira unidade compatível.</p><div class="sd-bag-grid">${plan.items.map(item=>materialTile(item,{remaining:plan.remaining(item.id),disabled:plan.remaining(item.id)<1,actionName:"place-material",draggable:true,subtitle:plan.remaining(item.id)>0?CATEGORIES[item.flags[ID].category]:"Na bancada"})).join("")||'<p class="sd-muted">Nenhum componente no inventário.</p>'}</div></aside></div><footer class="sd-footer sd-forge-footer"><span>${icon("fa-shield-halved")} Os materiais só são consumidos após a aprovação.</span>${action("submit",this.busy?"Enviando…":"Solicitar fabricação",this.busy?"fa-circle-notch":"fa-hammer",`class="sd-primary" ${!ready||this.busy?"disabled":""}`)}</footer>`;
  }
  bindEvents(signal){
    this.element.addEventListener("dragover",event=>{const slot=event.target.closest("[data-slot-index]");if(!slot||this.submitted)return;event.preventDefault();event.dataTransfer.dropEffect="copy";slot.classList.add("is-drag-over");},{signal});
    this.element.addEventListener("dragleave",event=>{const slot=event.target.closest("[data-slot-index]");if(slot&&!slot.contains(event.relatedTarget))slot.classList.remove("is-drag-over");},{signal});
    this.element.addEventListener("drop",event=>{
      const slot=event.target.closest("[data-slot-index]");if(!slot||this.submitted)return;event.preventDefault();event.stopPropagation();slot.classList.remove("is-drag-over");
      try{
        const editor=foundry.applications.ux?.TextEditor?.implementation;
        const data=editor?.getDragEventData?editor.getDragEventData(event):JSON.parse(event.dataTransfer.getData("text/plain"));
        const item=resolveInventoryDrop(data,this.actor);this.plan.setInventory(components(this.actor));this.plan.place(Number(slot.dataset.slotIndex),item.id);this.notice="";this.redraw();
      }catch(error){this.feedback(errorText(error));slot.classList.add("sd-reject");setTimeout(()=>slot.classList.remove("sd-reject"),350);}
    },{signal});
  }
  onInput(event){if(event.target.name==="forgeNotes")this.notes=event.target.value;}
  async onAction(action,target){
    if(this.busy)return;
    if(action==="remove"){this.plan.remove(Number(target.dataset.index));this.notice="";return this.redraw();}
    if(action==="clear"){this.plan.clear();this.notice="";return this.redraw();}
    if(action==="rarity"){this.plan.setRarity(target.dataset.rarity);if(this.recipe.workshop==="varies")this.workshop=this.plan.rarity;this.notice="";return this.redraw();}
    if(action==="workshop"){this.workshop=target.dataset.rarity;return this.redraw();}
    if(action==="place-material"){this.plan.setInventory(components(this.actor));this.plan.placeFirst(target.dataset.itemId);this.notice="";return this.redraw();}
    if(action==="slot"){this.feedback("Arraste um material da bolsa ou da sua ficha para este espaço.");return;}
    if(action==="submit"){
      if(this.submitted)return;this.busy=true;this.notice="";await this.redraw();
      try{const request=await submitRequest(this.actor,{recipeId:this.recipe.id,assignments:[...this.plan.assignments],rarity:this.plan.rarity,workshop:this.workshop,notes:this.notes});this.submitted={...request,status:"pending"};}
      catch(error){this.notice=errorText(error);}finally{this.busy=false;await this.redraw();}return;
    }
    return super.onAction(action,target);
  }
}

class StudyPanel extends GamePanel{
  static DEFAULT_OPTIONS={window:{title:"Estudo de componentes"},position:{width:820,height:730}};
  constructor(actor){super();this.kind="study";this.actor=actor;this.restId=actor.getFlag(ID,"study").restId;this.selected=new Set();this.busy=false;}
  async _renderHTML(){
    const study=this.actor.getFlag(ID,"study"),remaining=study?Math.max(0,study.limit-study.used.length):0,known=knownRecipes(this.actor).map(entry=>entry.id),all=recipes();
    const items=components(this.actor).filter(item=>!study?.used.includes(item.id));
    this.selected=new Set([...this.selected].filter(id=>items.some(item=>item.id===id&&studyCandidates(item,all,known).length)));
    return `${heroHeader({eyebrow:"Descanso longo",title:"À luz da descoberta",subtitle:`${this.actor.name} · ${remaining} análise(s) disponível(is)`,glyph:"fa-moon"})}<main class="sd-main"><div class="sd-study-intro"><p>Escolha os componentes que deseja examinar. Cada análise revela uma receita inédita, sorteada entre as compatíveis.</p><span class="sd-selection-count">${this.selected.size}/${remaining} selecionados</span></div><div class="sd-material-grid sd-study-grid">${items.map(item=>{
      const possible=studyCandidates(item,all,known).length>0;
      return materialTile(item,{actionName:"toggle-study",selected:this.selected.has(item.id),disabled:!possible||this.busy,subtitle:possible?"Disponível para estudo":"Nenhuma receita inédita compatível"});
    }).join("")||emptyState("fa-moon","Nenhum material para estudar","Colete novos componentes para fazer descobertas em outro descanso.")}</div>${this.feedbackHTML()}</main><footer class="sd-footer"><span class="sd-muted">O estudo preserva os componentes.</span>${action("study-confirm",this.busy?"Analisando…":"Analisar componentes","fa-wand-sparkles",`class="sd-primary" ${!this.selected.size||this.busy?"disabled":""}`)}</footer>`;
  }
  async onAction(action,target){
    if(this.busy)return;
    if(action==="toggle-study"){
      const id=target.dataset.itemId,study=this.actor.getFlag(ID,"study"),remaining=Math.max(0,study.limit-study.used.length);
      if(this.selected.has(id))this.selected.delete(id);else if(this.selected.size<remaining)this.selected.add(id);else return this.feedback("Você atingiu o limite de análises deste descanso.");
      this.notice="";return this.redraw();
    }
    if(action==="study-confirm"){
      this.busy=true;await this.redraw();
      try{const result=await serialize(()=>studyComponents(this.actor,[...this.selected],this.restId));await this.close();await refreshPlayerPanels(this.actor);const panel=new DiscoveryPanel(this.actor,result);await panel.redraw();}
      catch(error){this.busy=false;this.notice=errorText(error);await this.redraw();}return;
    }
    return super.onAction(action,target);
  }
}
class DiscoveryPanel extends GamePanel{
  static DEFAULT_OPTIONS={window:{title:"Novas descobertas"},position:{width:760,height:620}};
  constructor(actor,result){super();this.kind="discovery";this.actor=actor;this.result=result;this.notice=result.chatError??"";}
  async _renderHTML(){
    const learned=this.result.learned;
    return `${heroHeader({eyebrow:"Conhecimento conquistado",title:learned.length?"Uma nova página no grimório":"O estudo foi concluído",subtitle:learned.length?`${learned.length} receita(s) inédita(s) descoberta(s)`:"Nenhuma receita inédita compatível restante",glyph:"fa-sparkles"})}<main class="sd-main"><div class="sd-discovery-grid">${learned.map((entry,index)=>{const recipe=getRecipe(entry.id);return `<article class="sd-discovery-card" style="--rarity:${colors[recipe?.rarity]??colors.veryRare};--delay:${index*90}ms"><span class="sd-discovery-seal">${recipeArt(recipe)}</span>${rarityBadge(recipe?.rarity)}<h2>${e(recipe?.name??"Receita indisponível")}</h2>${recipe?.originalName?`<p class="sd-discovery-original" lang="en">${e(recipe.originalName)}</p>`:""}<p>Descoberta ao estudar</p><strong>${e(entry.componentName)}</strong></article>`;}).join("")}</div>${this.feedbackHTML()}${this.result.unavailable.length?`<p class="sd-rule">Sem nova descoberta para ${this.result.unavailable.map(item=>e(item.name)).join(", ")}. Essas análises não foram gastas.</p>`:""}<p class="sd-saved">${icon("fa-check")} ${learned.length?"As receitas já estão salvas no personagem.":"Seus materiais foram preservados."}</p></main><footer class="sd-footer"><span></span>${action("book","Abrir grimório","fa-book-open")}${action("close","Concluir","fa-check")}</footer>`;
  }
}

export function refreshPlayerPanels(actor){
  const pending=[];for(const panel of panels){if(!panel.rendered)continue;if(!actor||panel.actor?.uuid===actor.uuid||panel.token?.actor?.uuid===actor.uuid)pending.push(panel.redraw());}return Promise.all(pending);
}
export function refreshLootPanels(token){for(const panel of panels)if(panel.kind==="loot"&&panel.rendered&&panel.token.uuid===token.uuid)panel.redraw();}
export function closeLootPanels(token){for(const panel of panels)if(panel.kind==="loot"&&panel.token.uuid===token.uuid)panel.close();}
export function openPlayerBook(actor){
  if(actor?.type!=="character")actor=undefined;
  actor??=harvestDestination()??accessibleActors()[0];
  if(!actor||!owns(actor)){ui.notifications.warn("Selecione um personagem que você controla para abrir o grimório.");return;}
  let panel=[...panels].find(panel=>panel.kind==="book"&&!panel.closed);
  if(!panel)panel=new PlayerBook(actor);panel.actor=actor;panel.redraw({activate:true});return panel;
}
export function openForge(actor,recipe){
  if(!actor||!owns(actor)||!recipe||!knownRecipes(actor).some(entry=>entry.id===recipe.id))throw new Error("Selecione uma receita conhecida por este personagem.");
  let panel=[...panels].find(panel=>panel.kind==="forge"&&panel.actor.uuid===actor.uuid&&panel.recipe.id===recipe.id&&!panel.closed);
  if(!panel)panel=new ForgePanel(actor,recipe);panel.redraw({activate:true});return panel;
}
export function openPlayerStudy(actor){
  if(!actor||!owns(actor))throw new Error("Selecione um personagem que você controla.");
  const study=actor.getFlag(ID,"study");
  if(!study||study.used.length>=study.limit)return ui.notifications.info("Conclua um descanso longo para ter novas análises disponíveis.");
  const known=knownRecipes(actor).map(entry=>entry.id);
  if(!components(actor).some(item=>!study.used.includes(item.id)&&studyCandidates(item,recipes(),known).length))return ui.notifications.info("Nenhum componente disponível pode revelar uma receita compatível que você ainda não conhece.");
  let panel=[...panels].find(panel=>panel.kind==="study"&&panel.actor.uuid===actor.uuid&&!panel.closed);if(!panel)panel=new StudyPanel(actor);panel.redraw({activate:true});return panel;
}
export function openLoot(token){
  if(!isDefeatedEnemy(token))throw new Error("A coleta exige um inimigo com exatamente 0 PV.");
  const actor=harvestDestination();if(!actor)throw new Error("Selecione apenas o token do personagem que receberá os componentes.");
  const monster=harvestProfile(token);if(!monster)throw new Error("Esta criatura ainda não tem componentes cadastrados. O mestre pode vinculá-la ao catálogo nas opções da janela de configuração do token.");
  if(!monster.parts.length)return ui.notifications.info("Não há componentes coletáveis cadastrados para esta criatura.");
  let panel=[...panels].find(panel=>panel.kind==="loot"&&panel.token.uuid===token.uuid&&!panel.closed);if(!panel)panel=new LootPanel(token,actor);panel.actor=actor;panel.redraw({activate:true});return panel;
}
