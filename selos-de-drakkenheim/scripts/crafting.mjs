import {ID,RARITIES,CATEGORIES,assert,recipeSlots,matchSlot,validateCombination,workshopMeets} from "./core.mjs";

/** A craft reserves units in the interface. Inventory changes only after GM approval. */
export class CraftingPlan {
  constructor(recipe,items,rarity=recipe.rarity==="varies"?"common":recipe.rarity){
    this.recipe=recipe;this.slots=recipeSlots(recipe);this.items=items;
    this.rarity=rarity;this.assignments=this.slots.map(()=>null);
  }
  setInventory(items){this.items=items;this.assignments=this.assignments.map(id=>items.some(item=>item.id===id)?id:null);}
  setRarity(rarity){assert(RARITIES[rarity],"Escolha uma raridade válida.");this.rarity=rarity;this.clear();}
  clear(){this.assignments.fill(null);}
  remove(index){this.assignments[index]=null;}
  get filled(){return this.assignments.filter(Boolean).length;}
  reserved(id,except=-1){return this.assignments.filter((value,index)=>index!==except&&value===id).length;}
  remaining(id){const item=this.items.find(item=>item.id===id);return Math.max(0,Number(item?.system.quantity??0)-this.reserved(id));}
  check(index,itemId){
    const slot=this.slots[index],item=this.items.find(item=>item.id===itemId);
    if(!slot||!item)return "Este material não está mais no inventário.";
    const component=item.flags?.[ID];
    if(component?.category!==slot.category)return `Este espaço pede ${CATEGORIES[slot.category].toLocaleLowerCase("pt-BR")}.`;
    if(!workshopMeets(component.rarity,this.rarity))return `Este espaço pede um componente de raridade ${RARITIES[this.rarity].toLocaleLowerCase("pt-BR")} ou superior.`;
    if(!matchSlot(slot,item,this.rarity))return "A parte ou a criatura de origem não atende a este requisito.";
    if(this.reserved(itemId,index)>=Number(item.system.quantity))return "Todas as unidades deste material já estão na bancada.";
    if(slot.distinct||this.recipe.other){
      if(!component.origin)return "Este material precisa ter a origem da coleta registrada pelo mestre.";
      const duplicate=this.assignments.some((id,other)=>{
        if(!id||other===index)return false;
        const sameGroup=this.recipe.other || (this.slots[other].category===slot.category&&this.slots[other].raw===slot.raw);
        return sameGroup&&this.items.find(item=>item.id===id)?.flags?.[ID]?.origin===component.origin;
      });
      if(duplicate)return "Estes componentes precisam vir de criaturas diferentes.";
    }
    return "";
  }
  place(index,itemId){const error=this.check(index,itemId);assert(!error,error);this.assignments[index]=itemId;}
  placeFirst(itemId){
    const index=this.slots.findIndex((_,index)=>!this.assignments[index]&&!this.check(index,itemId));
    assert(index>=0,"Não há um espaço livre compatível com este material.");this.place(index,itemId);return index;
  }
  get validation(){try{return {ok:true,...validateCombination(this.recipe,this.items,this.assignments,this.rarity)}}catch(error){return {ok:false,error:error.message}}}
}

export function resolveInventoryDrop(data,actor){
  assert(data?.type==="Item"&&typeof data.uuid==="string","Arraste um componente do inventário do personagem.");
  const items=actor.items.values?[...actor.items.values()]:actor.items;
  const item=items.find(item=>(item.uuid??`${actor.uuid}.Item.${item.id}`)===data.uuid);
  assert(item?.flags?.[ID]?.kind==="component","Use um componente que esteja no inventário deste personagem.");
  return item;
}
