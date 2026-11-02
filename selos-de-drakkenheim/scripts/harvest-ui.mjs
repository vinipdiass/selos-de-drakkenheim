import {ID,CATEGORIES,RARITIES,escapeHTML as e,normalize} from "./core.mjs";
import {catalog,genericParts} from "./catalog.mjs";
import {harvestProfile,partKey,saveHarvestConfig} from "./harvest.mjs";
import {GamePanel} from "./player-ui.mjs";
import {harvestConfigFor} from "./anatomy.mjs";

export class HarvestConfigPanel extends GamePanel{
  static DEFAULT_OPTIONS={window:{title:"Configurar coleta da criatura"},position:{width:820,height:760}};
  constructor(target,{prototype=false,sourceApplication}={}){
    super();this.kind="harvest-config";this.target=target;this.prototype=prototype;this.sourceApplication=sourceApplication;this.actor=prototype?target:target.actor;
    this.token=prototype?{actor:target,actorId:target.id,name:target.name,flags:target.prototypeToken?.flags??{},getFlag:(_scope,key)=>target.prototypeToken?.flags?.[ID]?.[key]}:target;
    const profile=harvestProfile(this.token),config=harvestConfigFor(this.token);
    this.parts=structuredClone(profile?.parts??[]);this.rarity=profile?.rarity??"common";this.monsterId=config?.monsterId??(profile?.inferred?"":profile?.id)??"";this.query="";
  }
  async _renderHTML(){
    const options=new Map([...genericParts(),...this.parts].map(part=>[partKey(part),part]));
    return `<header class="sd-hero"><div class="sd-hero-copy"><span class="sd-eyebrow">Configuração do mestre · ${this.prototype?"Token protótipo":"Token do mapa"}</span><h1>${e(this.actor.name)}</h1><p>Escolha as partes coletáveis desta criatura. Uma lista vazia impede qualquer coleta.</p></div></header><main class="sd-main"><label class="sd-field"><span>Base do catálogo (opcional)</span><select name="harvestBase"><option value="">Ficha da criatura e anatomia estimada</option>${catalog.monsters.map(monster=>`<option value="${monster.id}" ${monster.id===this.monsterId?"selected":""}>${e(monster.name)}</option>`).join("")}</select></label><div class="sd-center-actions"><button type="button" data-game-action="load-base">Carregar partes dessa base</button></div><label class="sd-field"><span>Raridade dos componentes</span><select name="harvestRarity">${Object.entries(RARITIES).map(([key,label])=>`<option value="${key}" ${this.rarity===key?"selected":""}>${label}</option>`).join("")}</select></label><p class="sd-muted">A anatomia estimada usa o tipo e características da ficha. Confira a lista e ajuste as exceções antes de salvar. O protótipo serve como padrão; um token do mapa pode ter sua própria configuração.</p><input type="search" name="harvestSearch" value="${e(this.query)}" placeholder="Buscar parte ou categoria…" aria-label="Buscar componente"><div class="sd-harvest-options">${[...options].map(([key,part])=>`<label data-part-search="${e(normalize(`${part.name} ${CATEGORIES[part.category]}`))}"><input type="checkbox" name="harvestPart" value="${e(key)}" ${this.parts.some(row=>partKey(row)===key)?"checked":""}><span><strong>${e(part.name)}</strong><small>${e(CATEGORIES[part.category])}</small></span></label>`).join("")}</div><details><summary>Adicionar componente personalizado</summary><label class="sd-field"><span>Categoria</span><select name="customCategory">${Object.entries(CATEGORIES).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select></label><label class="sd-field"><span>Nome da parte em inglês (usado nas receitas)</span><input name="customPart" maxlength="100" placeholder="Ex.: Heart"></label><label class="sd-field"><span>Nome mostrado aos jogadores</span><input name="customPartName" maxlength="100" placeholder="Ex.: Coração"></label><button type="button" data-game-action="custom-part">Adicionar à lista</button></details>${this.feedbackHTML()}</main><footer class="sd-footer"><span class="sd-muted" data-harvest-count>${this.parts.length} partes selecionadas</span><button type="button" data-game-action="reset-harvest">Restaurar padrão automático</button><button type="button" class="sd-primary" data-game-action="save-harvest">Salvar coleta</button></footer>`;
  }
  filter(){this.element.querySelectorAll('[data-part-search]').forEach(row=>row.hidden=!row.dataset.partSearch.includes(normalize(this.query)));}
  onInput(event){if(event.target.name==="harvestSearch"){this.query=event.target.value;this.filter();}}
  onChange(event){
    if(event.target.name==="harvestBase")this.monsterId=event.target.value;
    if(event.target.name==="harvestRarity")this.rarity=event.target.value;
    if(event.target.name==="harvestPart"){
      const key=event.target.value,part=[...this.parts,...genericParts()].find(row=>partKey(row)===key);
      if(event.target.checked&&part&&!this.parts.some(row=>partKey(row)===key))this.parts.push({...part,affinities:part.category==="animus"?[harvestProfile(this.token)?.type??"monstrosity"]:part.affinities});
      else if(!event.target.checked)this.parts=this.parts.filter(row=>partKey(row)!==key);
      this.element.querySelector("[data-harvest-count]").textContent=`${this.parts.length} partes selecionadas`;
    }
  }
  async onAction(action){
    if(action==="load-base"){
      const profile=this.monsterId?catalog.monsters.find(monster=>monster.id===this.monsterId):harvestProfile(this.token,{ignoreConfig:true});
      this.parts=structuredClone(profile?.parts??[]);if(profile?.rarity)this.rarity=profile.rarity;return this.redraw();
    }
    if(action==="custom-part"){
      const category=this.element.querySelector('[name="customCategory"]').value,part=this.element.querySelector('[name="customPart"]').value.trim(),name=this.element.querySelector('[name="customPartName"]').value.trim();
      if(!part||!name)return this.feedback("Preencha os dois nomes da parte.");
      const value={category,part,name,affinities:[harvestProfile(this.token)?.type??"monstrosity"]};if(!this.parts.some(row=>partKey(row)===partKey(value)))this.parts.push(value);return this.redraw();
    }
    if(action==="save-harvest"||action==="reset-harvest"){
      const value=await saveHarvestConfig(this.target,action==="reset-harvest"?{mode:"auto"}:{mode:"custom",parts:this.parts,rarity:this.rarity,monsterId:this.monsterId},{prototype:this.prototype});
      this.sourceApplication?.token?.updateSource?.({[`flags.${ID}.harvestConfig`]:value});
      ui.notifications.info("Componentes coletáveis da criatura atualizados.");return this.close();
    }
    return super.onAction(action);
  }
}
export function openHarvestConfig(target,options){
  if(!game.user.isGM)throw new Error("Somente o mestre pode configurar a coleta.");
  const panel=new HarvestConfigPanel(target,options);panel.redraw({activate:true});return panel;
}
