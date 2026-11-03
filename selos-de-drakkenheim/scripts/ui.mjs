import {ID,RARITIES,CATEGORIES,TYPES,escapeHTML as e,normalize,rarityFromCR,componentData,recipeSlots,validateCombination,safeImage,sourceTraitsFromActor,requireHarvestTools} from "./core.mjs";
import {catalog,recipes,getRecipe,components,knownRecipes,accessibleActors,owns,monsterIndex,resolveMonster,genericParts,componentImage,primaryGM} from "./catalog.mjs";
import {grantRecipe,requests,resolveRequest,recoverRequest,isAuthority} from "./service.mjs";
import {linkRecipeItem} from "./result-links.mjs";
import {selectedResult} from "./bindings.mjs";
import {openPlayerBook,openPlayerStudy,openForge,refreshPlayerPanels,openRecipeBinding,openStudyReview} from "./player-ui.mjs";
import {studyRequests,rescanStudyRequests} from "./study-requests.mjs";

const {ApplicationV2,DialogV2}=foundry.applications.api;
const option=(value,label,selected)=>`<option value="${e(value)}" ${value===selected?"selected":""}>${e(label)}</option>`;
const options=(record,selected)=>Object.entries(record).map(([k,v])=>option(k,v,selected)).join("");
const field=(label,input)=>`<label class="selos-field"><span>${e(label)}</span>${input}</label>`;
const button=(action,label,icon="fa-book-open",extra="")=>`<button type="button" data-action="${action}" ${extra}><i class="fa-solid ${icon}" aria-hidden="true"></i> ${e(label)}</button>`;
const SOURCE_TRAIT_LABELS={dealsLightning:"Causa dano elétrico",shapechanger:"Possui a característica Metamorfo",coldImmune:"É imune a dano de frio"};
const sourceTraitFields=traits=>`<fieldset class="selos-source-traits"><legend>Características da criatura de origem</legend><p class="selos-note">Confira na ficha. Essas informações também determinam quais receitas podem ser descobertas ao estudar o componente.</p>${Object.entries(SOURCE_TRAIT_LABELS).map(([key,label])=>`<label><input type="checkbox" name="trait-${key}" ${traits[key]?"checked":""}> ${label}</label>`).join("")}</fieldset>`;
export function report(error){console.error(`${ID} |`,error);ui.notifications.error(error.message ?? String(error));}
export function run(task){return Promise.resolve().then(task).catch(report);}
async function formDialog(title,content,{label="Salvar",width=620,render}={}) {
  return DialogV2.wait({window:{title},position:{width},content:`<div class="selos-form">${content}</div>`,buttons:[{action:"save",label,default:true,callback:(_event,_button,dialog)=>dialog.element.querySelector("form")},{action:"cancel",label:"Cancelar",callback:()=>false}],render,close:()=>null,rejectClose:false});
}

export class SelosApp extends ApplicationV2 {
  static DEFAULT_OPTIONS={id:"selos-de-drakkenheim-book",classes:["selos-app"],window:{title:"Selos de Drakkenheim",icon:"fa-solid fa-book-skull",resizable:true},position:{width:850,height:700}};
  constructor(actor,view="book") {super();this.actor=actor ?? accessibleActors()[0];this.view=view;this.search="";this.rarity="";}
  async _renderHTML() {
    const actor=this.actor;
    const top=`<header class="selos-banner"><div><h1>Selos de Drakkenheim</h1><p>Componentes, descobertas e criação de itens mágicos</p></div><i class="fa-solid fa-book-skull" aria-hidden="true"></i></header>`;
    const actorOptions=accessibleActors();if(actor && !actorOptions.some(a=>a.uuid===actor.uuid)) actorOptions.push(actor);
    const nav=`<div class="selos-toolbar">${field("Personagem",`<select data-filter="actor">${option("","Escolha um personagem",actor?.uuid)}${actorOptions.map(a=>option(a.uuid,a.name,actor?.uuid)).join("")}</select>`)}${button("book","Minhas receitas")}${game.user.isGM?button("catalogue","Catálogo","fa-scroll")+button("harvest","Coletar","fa-paw")+button("requests","Pedidos","fa-hammer"):""}</div>`;
    if(this.view==="harvest") return top+nav+await this.harvestHTML();
    if(this.view==="requests") return top+nav+this.requestsHTML();
    const known=new Set(knownRecipes(actor ?? {getFlag:()=>[]}).map(r=>r.id));
    const rows=recipes().filter(r=>this.view==="catalogue" || known.has(r.id));
    const search=`<div class="selos-search"><input type="search" data-filter="search" value="${e(this.search)}" placeholder="Pesquisar receita…" aria-label="Pesquisar receita"><select data-filter="rarity">${option("","Todas as raridades",this.rarity)}${options({...RARITIES,varies:"Variável"},this.rarity)}</select>${game.user.isGM && this.view==="catalogue"?button("new-recipe","Nova receita","fa-plus"):""}</div>`;
    const allowance=actor?.getFlag(ID,"study");
    const rest=actor && this.view==="book" && allowance ? `<div class="selos-callout">Descanso longo: ${Math.max(0,allowance.limit-allowance.used.length)} análise(s) disponível(is). ${button("study","Analisar componentes","fa-magnifying-glass")}</div>`:"";
    const list=rows.map(r=>`<article class="selos-recipe" data-recipe="${e(r.id)}" data-search="${e(normalize(`${r.name} ${r.originalName}`))}" data-rarity="${r.rarity}"><div class="selos-recipe-heading"><div><h2>${e(r.name)}</h2><span class="selos-rarity ${r.rarity}">${e(RARITIES[r.rarity]??"Variável")}</span><span>${e(r.category)}</span></div><div class="selos-row-actions">${this.view==="catalogue"?button("grant",known.has(r.id)?"Já conhecida":"Ensinar","fa-graduation-cap",`data-id="${r.id}" ${!actor || known.has(r.id)?"disabled":""}`)+button("link","Vincular resultado","fa-link",`data-id="${r.id}"`):button("craft","Fabricar","fa-hammer",`data-id="${r.id}"`)}</div></div><details><summary>Componentes e requisitos (${recipeSlots(r).length})</summary><p>Oficina: <strong>${e(RARITIES[r.workshop]??"Mesma raridade do item")}</strong></p><ul>${r.requirements.map(q=>`<li><strong>${CATEGORIES[q.category]}:</strong> ${e(q.label)}</li>`).join("")}</ul>${r.other?`<p>${e(r.other)}</p>`:""}${r.attunement?`<p>${e(r.attunement)}</p>`:""}<p class="selos-note">${Object.values(r.bindings??{}).some(rows=>rows.length)?"Resultado vinculado a um item do Foundry.":"O mestre vincula o item de resultado antes de aprovar a fabricação."}</p></details></article>`).join("");
    return top+nav+search+rest+(!actor && this.view==="book"?`<p class="selos-empty">Abra a ficha de um personagem que você controla ou selecione um personagem.</p>`:`<section class="selos-list">${list || `<p class="selos-empty">${this.view==="book"?"Este personagem ainda não aprendeu receitas. Estude componentes em um descanso longo ou peça ao mestre para ensinar uma receita.":"Nenhuma receita cadastrada."}</p>`}</section><p class="selos-no-results" hidden>Nenhuma receita corresponde à pesquisa.</p>`);
  }
  _replaceHTML(result,content){content.innerHTML=result;}
  async _onRender(context,options_) {
    await super._onRender(context,options_);
    this._selosEvents?.abort();
    this._selosEvents=new AbortController();
    this.element.addEventListener("click",event=>{
      const target=event.target.closest(".window-content [data-action]");if(!target)return;
      event.preventDefault();
      run(async()=>{
        target.disabled=true;
        try{await this.action(target.dataset.action,target.dataset.id);}finally{if(target.isConnected)target.disabled=false;}
      });
    },{signal:this._selosEvents.signal});
    this.element.querySelector('[data-filter="actor"]')?.addEventListener("change",event=>run(async()=>{this.actor=event.target.value?await fromUuid(event.target.value):null;await this.render();}));
    this.element.querySelector('[data-filter="search"]')?.addEventListener("input",event=>{this.search=event.target.value;this.filterRecipes();});
    this.element.querySelector('[data-filter="rarity"]')?.addEventListener("change",event=>{this.rarity=event.target.value;this.filterRecipes();});
    this.element.querySelector('[data-filter="monster-search"]')?.addEventListener("input",event=>{this.monsterSearch=event.target.value;this.filterMonsters();});
    this.element.querySelector('[data-filter="monster"]')?.addEventListener("change",event=>{this.monsterKey=event.target.value;});
    this.filterRecipes();
  }
  filterRecipes(){let visible=0;this.element.querySelectorAll(".selos-recipe[data-search]").forEach(row=>{row.hidden=!(row.dataset.search.includes(normalize(this.search)) && (!this.rarity || row.dataset.rarity===this.rarity));if(!row.hidden)visible++;});const message=this.element.querySelector(".selos-no-results");if(message)message.hidden=visible>0;}
  filterMonsters(){const select=this.element.querySelector('[data-filter="monster"]');if(!select)return;const filtered=this.monsters.filter(m=>normalize(m.name).includes(normalize(this.monsterSearch)));const key=filtered.some(m=>m.key===this.monsterKey)?this.monsterKey:filtered[0]?.key;select.innerHTML=filtered.slice(0,300).map(m=>option(m.key,`${m.name} — ${m.source}`,key)).join("");this.monsterKey=select.value;const count=this.element.querySelector(".selos-monster-count");if(count)count.textContent=`${filtered.length} criatura(s) encontrada(s)${filtered.length>300?". Refine a pesquisa para ver as demais.":"."}`;}
  async action(action,id) {
    if(action==="book")return openPlayerBook(this.actor);
    if(["book","catalogue","requests","harvest"].includes(action)){if(action!=="book" && !game.user.isGM) return;this.view=action;this.search="";return this.render();}
    if(action==="study")return openStudy(this.actor);
    if(action==="grant"){if(!this.actor)throw new Error("Selecione um personagem.");await grantRecipe(this.actor,id);ui.notifications.info("Receita adicionada ao livro do personagem.");return this.render();}
    if(action==="craft")return openCraft(this.actor,getRecipe(id));
    if(action==="link"){await linkRecipe(getRecipe(id));return this.render();}
    if(action==="collect"){const entry=this.monsters.find(m=>m.key===this.monsterKey);if(!entry)throw new Error("Selecione uma criatura.");return openHarvest(await resolveMonster(entry),this.actor);}
    if(action==="manual-monster")return openManualHarvest(this.actor);
    if(action==="review")return openReview(id);
    if(action==="review-study")return openStudyReview(id);
    if(action==="recover"){await recoverRequest(id);return this.render();}
    if(action==="new-recipe"){await newRecipe();return this.render();}
    if(action==="images")return configureImages();
    if(action==="rescan"){const {rescanRequests}=await import("./service.mjs");await rescanRequests();await rescanStudyRequests();return this.render();}
  }
  async harvestHTML(){
    if(!game.user.isGM)return "";
    this.monsters=await monsterIndex();
    const filtered=this.monsters.filter(m=>normalize(m.name).includes(normalize(this.monsterSearch)));
    this.monsterKey ??=filtered[0]?.key;
    return `<section class="selos-panel"><h2>Coletar componentes</h2><p>Pesquise criaturas da planilha, do mundo ou dos compêndios. O retrato vem do ator encontrado no Foundry.</p>${field("Nome do monstro",`<input type="search" data-filter="monster-search" value="${e(this.monsterSearch??"")}" placeholder="Ex.: Ratling, Troll…">`)}<p class="selos-monster-count">${filtered.length} criatura(s) encontrada(s). Refine a pesquisa para limitar os resultados.</p><select size="12" data-filter="monster" aria-label="Criaturas encontradas">${filtered.slice(0,300).map(m=>option(m.key,`${m.name} — ${m.source}`,this.monsterKey)).join("")}</select><footer>${button("collect","Escolher componente","fa-paw")}${button("manual-monster","Criatura manual","fa-plus")}${button("images","Imagens","fa-image")}</footer></section>`;
  }
  requestsHTML(){
    if(!game.user.isGM)return "";
    const list=[...requests()].sort((a,b)=>b.submittedAt-a.submittedAt);
    const states={pending:"Aguardando aprovação",processing:"Fabricação interrompida ou em andamento",recovery:"Materiais precisam de restauração",completed:"Concluída",rejected:"Recusada"};
    return `<section class="selos-panel"><h2>Pedidos</h2><p>As decisões são processadas pelo mestre ativo${primaryGM()?`: ${e(primaryGM().name)}`:""}.</p>${button("rescan","Atualizar pedidos do chat","fa-arrows-rotate")}<h2>Pedidos de estudo</h2><div class="selos-list">${[...studyRequests()].sort((a,b)=>b.submittedAt-a.submittedAt).map(row=>`<article class="selos-recipe"><h3>Estudo de ${e(game.actors.get(row.actorUuid.split(".")[1])?.name??"Personagem")}</h3><p>${row.itemIds.length} componente(s) — ${e(({pending:"Aguardando aprovação",completed:"Aprovado",rejected:"Recusado"})[row.status]??row.status)}</p>${button("review-study",row.status==="pending"?"Revisar estudo":"Ver estudo","fa-book-open",`data-id="${row.id}"`)}</article>`).join("")||"<p>Nenhum pedido de estudo registrado.</p>"}</div><h2>Pedidos de fabricação</h2><div class="selos-list">${list.map(r=>`<article class="selos-recipe"><h3>${e(getRecipe(r.recipeId)?.name??"Receita removida")}</h3><p>${e(game.actors.get(r.actorUuid.split(".")[1])?.name??r.actorUuid)} — ${e(states[r.status]??r.status)}</p>${r.error?`<p class="selos-error">${e(r.error)}</p>`:""}${r.status==="pending"?button("review","Revisar","fa-hammer",`data-id="${r.id}" ${!isAuthority()?"disabled":""}`):""}${["processing","recovery"].includes(r.status)?button("recover","Restaurar materiais / concluir registro","fa-rotate-left",`data-id="${r.id}" ${!isAuthority()?"disabled":""}`):""}</article>`).join("")||"<p>Nenhum pedido registrado.</p>"}</div></section>`;
  }
}
let app;
export function openBook(actor,view="book"){
  if(view==="book")return openPlayerBook(actor);
  if(actor && !owns(actor))return ui.notifications.warn("Você precisa controlar este personagem.");
  if(app?.rendered){if(actor)app.actor=actor;app.view=view;app.render({force:true});return app;}
  app=new SelosApp(actor,view);app.render({force:true});return app;
}
export function refreshBook(actor){if(app?.rendered)app.render();refreshPlayerPanels(actor);}

export function openStudy(actor,options){return openPlayerStudy(actor,options);}
export function openCraft(actor,recipe){return openForge(actor,recipe);}
export async function editComponentTraits(item){
  if(!game.user.isGM || item?.getFlag(ID,"kind")!=="component")throw new Error("Somente o mestre pode conferir a origem de um componente.");
  const component=item.flags[ID];
  const source=game.actors.find(actor=>normalize(actor.name)===normalize(component.monster));
  const traits=component.sourceTraits??(source?sourceTraitsFromActor(source):{});
  const form=await formDialog("Conferir origem do componente",`<p><strong>${e(item.name)}</strong></p>${sourceTraitFields(traits)}`);
  if(!form)return;
  const data=new FormData(form);
  await item.setFlag(ID,"sourceTraits",Object.fromEntries(Object.keys(SOURCE_TRAIT_LABELS).map(key=>[key,data.get(`trait-${key}`)==="on"])));
  ui.notifications.info("Características da origem atualizadas.");refreshBook();
}
export async function openHarvest(monster,actor) {
  if(!game.user.isGM)throw new Error("Somente o mestre pode criar componentes.");
  const parts=monster.parts?.length?monster.parts:genericParts();
  const initialRarity=monster.rarity || rarityFromCR(monster.cr) || "";
  const traits=monster.sourceTraits??{};
  const destinations=accessibleActors();if(actor&&!destinations.some(a=>a.uuid===actor.uuid))destinations.push(actor);
  const form=await formDialog(`Coletar — ${monster.name}`,`${!monster.parts?.length?'<p class="selos-callout">Criatura sem anatomia na planilha. O mestre deve escolher uma parte presente nesta criatura.</p>':""}${field("Componente",`<select name="part">${parts.map((p,i)=>option(String(i),`${p.name} — ${CATEGORIES[p.category]}`)).join("")}</select>`)}<div class="selos-columns">${field("Tipo de criatura",`<select name="type">${options(TYPES,monster.type)}</select>`)}${field("Raridade",`<select name="rarity" required>${option("","Defina a raridade",initialRarity)}${options(RARITIES,initialRarity)}</select>`)}</div><p>ND: ${e(monster.cr??"não informado")}. Raridade pelo ND: ${e(RARITIES[rarityFromCR(monster.cr)]??"sem faixa definida")}. A seleção inicial usa a raridade específica da planilha, quando disponível.</p><div class="selos-columns">${field("Quantidade de coletas",'<input type="number" name="quantity" min="1" max="999" step="1" value="1" required>')}${field("Peso por componente (kg)",'<input type="number" name="weight" min="0" step="0.1" value="0.5" required>')}</div>${field("Destino",`<select name="destination">${option("world","Aba Itens do mundo","world")}${destinations.map(a=>option(a.uuid,`Inventário: ${a.name}`)).join("")}</select>`)}<p class="selos-note">Para criar no inventário de um personagem, ele precisa de um Container chamado Monster Harvesting Tools. O componente será guardado dentro dele.</p>${field("Origem da coleta (identifica o cadáver)",`<input name="origin" value="${e(`${monster.name} — ${foundry.utils.randomID(6)}`)}" required>`)}<p class="selos-note">Use a mesma origem para partes do mesmo cadáver. Para receitas que exigem criaturas diferentes, registre cada cadáver separadamente.</p>${field("Retrato da criatura (URL ou caminho no Foundry)",`<input name="portrait" value="${e(monster.portrait??"")}" placeholder="Selecione o ator no mundo para usar seu retrato automaticamente">`)}${field("Imagem do componente (URL opcional)",'<input name="img" placeholder="Em branco: procurar imagem do Witcher">')}${sourceTraitFields(traits)}<label><input type="checkbox" name="dead"> A criatura está morta (obrigatório para coletar a ânima).</label>`,{label:"Criar componente"});
  if(!form)return;
  const data=new FormData(form),part=parts[Number(data.get("part"))];
  if(part.category==="animus"&&!data.get("dead"))throw new Error("É impossível coletar a ânima sem matar a criatura.");
  const type=data.get("type");
  const adjusted={...part,affinities:part.category==="animus" && !monster.parts?.length?[type]:part.affinities};
  const sourceTraits=Object.fromEntries(["dealsLightning","shapechanger","coldImmune"].map(key=>[key,data.get(`trait-${key}`)==="on"]));
  const item=componentData({monster:{...monster,type,sourceTraits},part:adjusted,rarity:data.get("rarity"),quantity:Number(data.get("quantity")),weight:Number(data.get("weight")),img:await componentImage(part,data.get("img")),portrait:data.get("portrait"),origin:String(data.get("origin"))});
  if(data.get("destination")==="world"){
    let folder=game.folders.find(f=>f.type==="Item"&&f.name==="Componentes de Drakkenheim"&&!f.folder);
    folder ??=await Folder.create({name:"Componentes de Drakkenheim",type:"Item",color:"#725a91"});
    item.folder=folder.id;
    const created=await Item.create(item);created.sheet.render({force:true});
  }else{
    const target=await fromUuid(data.get("destination"));
    if(!target || target.documentName!=="Actor")throw new Error("Personagem de destino indisponível.");
    item.system.container=requireHarvestTools(target).id;
    await target.createEmbeddedDocuments("Item",[item]);
  }
  ui.notifications.info(`Componente criado: ${item.name}.`);refreshBook();
}
async function openManualHarvest(actor){
  const form=await formDialog("Criatura manual",field("Nome da criatura",'<input name="name" required>')+field("Nível de desafio",'<input name="cr" placeholder="Ex.: 1/4 ou 5">')+field("Tipo de criatura",`<select name="type">${options(TYPES,"monstrosity")}</select>`)+field("Retrato",'<input name="portrait">'));
  if(!form)return;const data=new FormData(form);
  return openHarvest({name:String(data.get("name")),cr:data.get("cr"),type:data.get("type"),portrait:data.get("portrait"),parts:[]},actor);
}
async function linkRecipe(recipe){return openRecipeBinding(recipe.id);}
export async function openReview(id){
  if(!isAuthority())throw new Error("Abra este pedido na sessão do mestre ativo.");
  const request=requests().find(r=>r.id===id);if(!request)throw new Error("Pedido não registrado. Atualize os pedidos do chat.");
  if(request.status!=="pending")return ui.notifications.info("Este pedido já foi processado. Consulte a lista de pedidos.");
  const actor=await fromUuid(request.actorUuid),recipe=getRecipe(request.recipeId);
  if(!actor||!recipe)throw new Error("Personagem ou receita indisponível.");
  const slots=recipeSlots(recipe),result=selectedResult(recipe,request.rarity,request.resultUuid);
  let invalid="";try{validateCombination(recipe,components(actor),request.assignments,request.rarity);}catch(error){invalid=error.message;}
  const content=`<div class="selos-form"><h3>${e(actor.name)} — ${e(recipe.name)}</h3><p>Raridade: ${e(RARITIES[request.rarity])}. Oficina informada: ${e(RARITIES[request.workshop])}.</p><ol>${slots.map((s,i)=>`<li>${e(s.label)}<br><strong>${e(actor.items.get(request.assignments[i])?.name??"Componente removido")}</strong></li>`).join("")}</ol><p>${e(request.notes)}</p>${invalid?`<p class="selos-error">${e(invalid)}</p>`:""}<p>Resultado: <strong>${e(result?.name??"Vínculo indisponível")}</strong></p><label><input type="checkbox" name="workshop"> Confirmo a disponibilidade e a raridade da oficina.</label><label><input type="checkbox" name="special"> Conferi os requisitos especiais da criatura (dano, imunidade ou características), quando existirem.</label><p>Ao aprovar, os componentes serão consumidos e uma cópia do item vinculado será adicionada ao inventário.</p></div>`;
  const decision=await DialogV2.wait({window:{title:"Aprovar fabricação"},position:{width:650},content,buttons:[{action:"approve",label:"Aprovar e fabricar",callback:(_event,_button,dialog)=>({approve:true,workshopConfirmed:dialog.element.querySelector('[name="workshop"]').checked,conditionsConfirmed:dialog.element.querySelector('[name="special"]').checked})},{action:"reject",label:"Recusar",callback:()=>({approve:false})},{action:"cancel",label:"Voltar",callback:()=>false}],rejectClose:false});
  if(!decision)return;
  await resolveRequest(id,decision);refreshBook();
}
async function newRecipe(){
  if(!game.user.isGM)throw new Error("Somente o mestre pode cadastrar receitas.");
  const parts=genericParts();
  const form=await formDialog("Nova receita",field("Nome em português",'<input name="name" required>')+field("Nome em inglês (opcional)",'<input name="originalName" placeholder="Nome original do item">')+field("Raridade",`<select name="rarity">${options(RARITIES,"common")}</select>`)+field("UUID do resultado",'<input name="uuid" placeholder="Opcional neste momento">')+`<p>Defina a quantidade e a parte de cada categoria. Quantidade zero deixa a categoria fora da receita.</p>${Object.entries(CATEGORIES).map(([cat,label])=>`<div class="selos-custom-row">${field(`${label} — quantidade`,`<input name="count-${cat}" type="number" min="0" max="10" step="1" value="0">`)}${field("Parte",`<select name="part-${cat}">${option("*","Qualquer parte desta categoria")}${parts.filter(p=>p.category===cat).map(p=>option(p.part,p.name)).join("")}</select>`)}${field("Tipo de criatura",`<select name="type-${cat}">${option("","Qualquer tipo")}${options(TYPES,"")}</select>`)}</div>`).join("")}<label><input type="checkbox" name="distinct"> Cada componente deve vir de uma criatura diferente.</label>`);
  if(!form)return;const data=new FormData(form),rarity=data.get("rarity"),requirements=[];
  const generic={animus:"Animus",bones:"Bones",dust:"Dust",fluid:"Fluid",hair:"Hair",hide:"Hide",natural:"Natural Weapon",organs:"Organ"};
  for(const [cat,label]of Object.entries(CATEGORIES)){
    const count=Number(data.get(`count-${cat}`));if(!Number.isInteger(count)||count<0||count>10)throw new Error("Use quantidades inteiras de zero a dez.");
    const part=data.get(`part-${cat}`),type=data.get(`type-${cat}`),rawpart=part==="*"?generic[cat]:part;
    const partName=parts.find(p=>p.category===cat&&p.part===part)?.name??label;
    for(let i=0;i<count;i++) requirements.push({category:cat,raw:`${rawpart}${type?` from a ${type}`:""}`,label:`${partName}${type?` de ${TYPES[type]}`:""}`});
  }
  if(!requirements.length||requirements.length>20)throw new Error("Cadastre entre 1 e 20 componentes.");
  const recipe={id:`custom-${foundry.utils.randomID()}`,name:String(data.get("name")).trim(),originalName:String(data.get("originalName")??"").trim(),category:"Receita personalizada",rarity,workshop:rarity,requirements,other:data.get("distinct")?"Cada componente deve vir de uma criatura diferente":"",resultUuid:String(data.get("uuid")).trim()};
  if(!recipe.name)throw new Error("Informe o nome da receita.");
  await game.settings.set(ID,"customRecipes",[...game.settings.get(ID,"customRecipes"),recipe]);
  if(recipe.resultUuid)await linkRecipeItem(recipe.id,recipe.resultUuid,recipe.rarity);
}
async function configureImages(){
  if(!game.user.isGM)throw new Error("Somente o mestre pode configurar imagens.");
  const configured=game.settings.get(ID,"componentImages");
  const form=await formDialog("Imagens dos componentes",`<p>Defina uma imagem para cada categoria. Deixe o campo vazio para usar a seleção automática de The Witcher 3. A imagem informada durante uma coleta tem prioridade.</p>${Object.entries(CATEGORIES).map(([cat,label])=>field(label,`<input name="${cat}" value="${e(configured[cat]??"")}" placeholder="URL ou caminho da imagem no Foundry">`)).join("")}`);
  if(!form)return;const data=new FormData(form),updated={...configured};
  for(const cat of Object.keys(CATEGORIES)){
    const value=String(data.get(cat)??"").trim();
    if(value && !safeImage(value,""))throw new Error(`Informe uma imagem válida para ${CATEGORIES[cat]}.`);
    if(value)updated[cat]=value;else delete updated[cat];
  }
  await game.settings.set(ID,"componentImages",updated);ui.notifications.info("Imagens dos componentes atualizadas.");
}
