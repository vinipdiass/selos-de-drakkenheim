import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {ID,rarityFromCR,studyLimit,componentData,recipeSlots,matchSlot,canStudy,validateCombination,workshopMeets,safeImage} from "../selos-de-drakkenheim/scripts/core.mjs";

const catalog=JSON.parse(fs.readFileSync(new URL("../selos-de-drakkenheim/data/catalog.json",import.meta.url)));
const recipe=name=>catalog.recipes.find(r=>r.originalName===name);
function item(category,part,{rarity="common",type="monstrosity",monster="Ratling",quantity=1,origin="corpse-1",affinities=[type]}={}) {
  return {id:`${category}-${part}`,system:{quantity},flags:{[ID]:{kind:"component",category,part,rarity,creatureType:type,monster,origin,affinities}}};
}
test("ND: faixas completas, frações, limites e valores não definidos",()=>{
  for(const [cr,expected]of [[null,null],["",null],[0,null],["1/8",null],["1/4","common"],[.5,"common"],[1,"uncommon"],[4,"uncommon"],[5,"rare"],[10,"rare"],[11,"veryRare"],[16,"veryRare"],[17,"legendary"],[30,"legendary"],["erro",null]])assert.equal(rarityFromCR(cr),expected,`${cr}`);
});
test("estudo usa pontuação ou modificador de Inteligência e nunca limite negativo",()=>{
  const actor={system:{abilities:{int:{value:16,mod:3}}}};assert.equal(studyLimit(actor),3);assert.equal(studyLimit(actor,"score"),16);assert.equal(studyLimit(actor,"modifier"),3);actor.system.abilities.int.mod=-1;assert.equal(studyLimit(actor),0);
});
test("componente respeita formato, idioma, metadados, peso e retrato",()=>{
  const result=componentData({monster:{name:"Ratling",type:"monstrosity"},part:{category:"natural",part:"Claws",name:"Garras"},rarity:"common",portrait:"actors/ratling.webp",origin:"ratling-1"});
  assert.equal(result.name,"Garras (Ratling) | (Comum)");assert.equal(result.system.rarity,"common");assert.deepEqual(result.system.weight,{value:.5,units:"kg"});assert.match(result.system.description.value,/ARMA NATURAL/);assert.match(result.system.description.value,/MONSTRUOSIDADE/);assert.match(result.system.description.value,/actors\/ratling.webp/);assert.equal(result.flags[ID].origin,"ratling-1");
});
test("componente escapa texto e rejeita imagens com protocolo executável",()=>{
  const result=componentData({monster:{name:'<script>x</script>',type:"dragon"},part:{category:"organs",part:"Heart",name:"Coração"},rarity:"rare",portrait:'javascript:alert(1)'});
  assert.doesNotMatch(result.system.description.value,/<script>/);assert.doesNotMatch(result.system.description.value,/javascript:/);assert.equal(safeImage("data:text/html,test"),"icons/svg/mystery-man.svg");
});
test("inventário rejeita quantidade fracionária e raridade inválida",()=>{
  const input={monster:{name:"Troll",type:"giant"},part:{category:"hide",part:"Skin",name:"Pele"},rarity:"rare"};assert.throws(()=>componentData({...input,quantity:1.5}));assert.throws(()=>componentData({...input,rarity:"invalid"}));
});
test("catálogo importado conserva 223 monstros, 73 receitas e 345 ingredientes",()=>{assert.equal(catalog.monsters.length,223);assert.equal(catalog.recipes.length,73);assert.equal(catalog.ingredients.length,345);assert.equal(new Set(catalog.recipes.map(r=>r.id)).size,73);});
test("ND convertido em data é recuperado e raridade específica é mantida",()=>{assert.equal(catalog.monsters.find(m=>m.name==="Ratling Warrior").cr,.125);const dragon=catalog.monsters.find(m=>m.name==="Adult Delerium Dragon");assert.equal(dragon.rarity,"veryRare");assert.equal(rarityFromCR(dragon.cr),"legendary");});
test("tradução não deixa nomes de pergaminhos em inglês",()=>{assert.equal(recipe("Spell Scroll (2nd–3rd Level)").name,"Pergaminho de Magia (2º–3º círculo)");assert.equal(recipe("Champion's Weapon").name,"Arma do Campeão");});
test("vírgulas entre partes exigem componentes separados; tipos na origem não",()=>{
  assert.equal(recipeSlots(recipe("Bracers of Arc Lightning")).length,6);
  const heart=recipeSlots(recipe("Cold Snap Circlet")).filter(s=>s.category==="organs");assert.equal(heart.length,1);assert.equal(heart[0].alternatives[0].manual,true);
});
test("alternativa com vírgulas e origem compartilhada não exige três ossos",()=>{
  const slot=recipeSlots(recipe("Sword Between Worlds")).find(s=>s.category==="bones");assert.equal(slot.alternatives.length,3);assert.equal(matchSlot(slot,item("bones","Spine",{rarity:"rare",type:"aberration"}),"rare"),true);
});
test("chifres ou dentes compartilham a restrição de origem",()=>{
  const slot=recipeSlots(recipe("Heart String Harp")).find(s=>s.category==="natural");
  assert.equal(matchSlot(slot,item("natural","Teeth",{type:"dragon"}),"common"),true);
  assert.equal(matchSlot(slot,item("natural","Horns",{type:"fey"}),"common"),true);
  assert.equal(matchSlot(slot,item("natural","Horns",{type:"beast"}),"common"),false);
});
test("dois fluidos elementais geram duas posições com origens diferentes",()=>{
  const slots=recipeSlots(recipe("Pendant of Prismatic Protection")).filter(s=>s.category==="fluid");assert.equal(slots.length,2);assert.equal(slots[0].distinct,true);assert.equal(matchSlot(slots[0],item("fluid","Elemental Fluid",{type:"elemental"}),"common"),true);
});
test("dois crânios de trolls podem ser usados na receita",()=>{
  const slots=recipeSlots(recipe("Hag-Stitched Troll Leather Armor")).filter(s=>s.category==="bones");assert.equal(slots.length,2);assert.equal(matchSlot(slots[0],item("bones","Skull",{monster:"Winter Troll",type:"giant"}),"common"),true);
});
test("restrições de espécie e raridade não aceitam outra criatura",()=>{
  const slot=recipeSlots(recipe("Charged Gauntlets")).find(s=>s.category==="hide");
  assert.equal(matchSlot(slot,item("hide","Scales",{monster:"Adult Blue Dragon",type:"dragon"}),"common"),true);
  assert.equal(matchSlot(slot,item("hide","Scales",{monster:"Adult Red Dragon",type:"dragon"}),"common"),false);
  assert.equal(matchSlot(slot,item("hide","Scales",{monster:"Blue Slaad",type:"aberration"}),"common"),false);
  assert.equal(matchSlot(slot,item("hide","Scales",{monster:"Adult Blue Dragon",type:"dragon",rarity:"rare"}),"common"),true);
});
test("pó e ânima respeitam seus tipos específicos",()=>{
  const r=recipe("Amulet of Primal Wisdom"),slots=recipeSlots(r);
  assert.equal(matchSlot(slots[0],item("animus","Animus",{type:"plant"}),"common"),true);
  assert.equal(matchSlot(slots[0],item("animus","Animus",{type:"undead"}),"common"),false);
  assert.equal(matchSlot(slots[1],item("dust","Undead Dust"),"common"),false);
});
test("combinação consome uma unidade de cada componente e não uma pilha inteira",()=>{
  const r=recipe("Potion of Healing"),items=[item("animus","Animus",{quantity:3}),item("fluid","Monster Blood",{quantity:2}),item("organs","Heart",{quantity:4})];
  const result=validateCombination(r,items,items.map(i=>i.id),"common");assert.deepEqual(Object.values(result.counts),[1,1,1]);
});
test("uma pilha não pode fornecer mais unidades do que tem",()=>{
  const r={requirements:[{category:"natural",raw:"Two Blades from a Reautomata",label:"Duas lâminas"}]};const i=item("natural","Blades",{monster:"Reautomata"});assert.throws(()=>validateCombination(r,[i],[i.id,i.id],"common"),/insuficiente/);i.system.quantity=2;assert.equal(validateCombination(r,[i],[i.id,i.id],"common").counts[i.id],2);
});
test("receita SRD exige origens distintas e não permite origem ausente",()=>{
  const r=recipe("Weapon +1"),items=[item("animus","Animus",{rarity:"uncommon",origin:"one"}),item("bones","Spine",{rarity:"uncommon",origin:"two"}),item("hide","Skin",{rarity:"uncommon",origin:"three"}),item("natural","Claws",{rarity:"uncommon",origin:"four"})];
  assert.doesNotThrow(()=>validateCombination(r,items,items.map(i=>i.id),"uncommon"));items[2].flags[ID].origin="one";assert.throws(()=>validateCombination(r,items,items.map(i=>i.id),"uncommon"),/diferentes/);items[2].flags[ID].origin="";assert.throws(()=>validateCombination(r,items,items.map(i=>i.id),"uncommon"),/origem/);
});
test("estudo só revela receita compatível com o componente e sua raridade",()=>{assert.equal(canStudy(item("fluid","Monster Blood"),recipe("Potion of Healing")),true);assert.equal(canStudy(item("hide","Skin"),recipe("Potion of Healing")),false);assert.equal(canStudy(item("fluid","Monster Blood",{rarity:"rare"}),recipe("Potion of Healing")),false);});
test("oficina suficiente inclui patamares superiores e rejeita valores desconhecidos",()=>{assert.equal(workshopMeets("rare","uncommon"),true);assert.equal(workshopMeets("common","rare"),false);assert.equal(workshopMeets("invalid","common"),false);});
test("todas as receitas têm posições e categorias reconhecidas, sem rótulos faltantes",()=>{
  for(const r of catalog.recipes){const slots=recipeSlots(r);assert.ok(slots.length>=1 && slots.length<=20,r.name);for(const s of slots){assert.ok(s.label,r.name);assert.ok(s.alternatives.every(a=>a.part && a.part!=="two elemental fluid"),r.name);}}
});
