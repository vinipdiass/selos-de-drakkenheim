import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {ID,canStudy,studyCandidates,drawStudyRecipes,sourceTraitsFromActor,componentData} from "../selos-de-drakkenheim/scripts/core.mjs";
const all=JSON.parse(fs.readFileSync(new URL("../selos-de-drakkenheim/data/catalog.json",import.meta.url))).recipes;
const recipe=name=>all.find(r=>r.originalName===name);
function item(category,part,{id="item",rarity="rare",type="monstrosity",monster="Ratling",sourceTraits}={}){
  return {id,system:{quantity:1},flags:{[ID]:{kind:"component",category,part,rarity,creatureType:type,monster,affinities:[type],sourceTraits}}};
}
const names=rows=>rows.map(r=>r.originalName);
test("garras de Ratling permitem receita específica e genérica da mesma raridade",()=>{
  const candidates=names(studyCandidates(item("natural","Claws"),all));
  assert.ok(candidates.includes("Rat Tooth Dagger"));assert.ok(candidates.includes("Talon Gloves"));assert.ok(candidates.includes("Weapon +2"));
  assert.ok(!candidates.includes("Weapon +1"));assert.ok(!candidates.includes("Whirling Bonesaw"));
});
test("garras de Troll continuam aceitas pela receita genérica e não pela específica de Ratling",()=>{
  const candidates=names(studyCandidates(item("natural","Claws",{monster:"Winter Troll",type:"giant"}),all));
  assert.ok(candidates.includes("Talon Gloves"));assert.ok(candidates.includes("Weapon +2"));assert.ok(!candidates.includes("Rat Tooth Dagger"));
});
test("nome parecido não satisfaz uma espécie específica",()=>{
  assert.equal(canStudy(item("natural","Claws",{monster:"Ratlingoid"}),recipe("Rat Tooth Dagger")),false);
  assert.equal(canStudy(item("natural","Claws",{monster:"Ratling Warrior"}),recipe("Rat Tooth Dagger")),true);
});
test("uma receita específica em outra posição ainda pode ser descoberta por um ingrediente genérico",()=>{
  assert.equal(canStudy(item("fluid","Monster Blood",{type:"beast",monster:"Bear"}),recipe("Blade of Retribution")),true);
  assert.equal(canStudy(item("hide","Skin",{type:"beast",monster:"Bear"}),recipe("Blade of Retribution")),false);
  assert.equal(canStudy(item("hide","Skin",{type:"fiend",monster:"Imp"}),recipe("Blade of Retribution")),true);
});
test("qualquer parte continua restrita à categoria indicada pela receita",()=>{
  const r=recipe("Swashbuckler's Boots");
  assert.equal(canStudy(item("hide","Carapace",{rarity:"uncommon",type:"beast"}),r),true);
  assert.equal(canStudy(item("organs","Heart",{rarity:"uncommon",type:"beast"}),r),false);
});
test("partes específicas não viram categorias genéricas",()=>{
  const r=recipe("Dazing Hammer"),rarity=r.rarity;
  assert.equal(canStudy(item("bones","Skull",{rarity,type:"giant",monster:"Troll"}),r),true);
  assert.equal(canStudy(item("bones","Spine",{rarity,type:"giant",monster:"Troll"}),r),false);
  assert.equal(canStudy(item("bones","Skull",{rarity,type:"beast",monster:"Bear"}),r),false);
});
test("tipo, subtipo e raridade corretos são necessários para escamas de dragão azul ou bronze",()=>{
  const r=recipe("Charged Gauntlets"),input=monster=>item("hide","Scales",{rarity:r.rarity,type:"dragon",monster});
  assert.equal(canStudy(input("Adult Blue Dragon"),r),true);assert.equal(canStudy(input("Adult Bronze Dragon"),r),true);
  assert.equal(canStudy(input("Adult Red Dragon"),r),false);assert.equal(canStudy(input("Adult Blue Draconic Horror"),r),false);
  assert.equal(canStudy(item("hide","Scales",{rarity:r.rarity,type:"aberration",monster:"Adult Blue Dragon"}),r),false);
});
test("afinidade da ânima é respeitada",()=>{
  const r=recipe("Trollblood Potion");assert.equal(canStudy(item("animus","Animus",{type:"fey"}),r),true);assert.equal(canStudy(item("animus","Animus",{type:"undead"}),r),false);
});
test("coração genérico não revela receita que exige origem específica ou imunidade a frio",()=>{
  const r=recipe("Cold Snap Circlet");
  assert.equal(canStudy(item("organs","Heart",{type:"beast",monster:"Bear"}),r),false);
  assert.equal(canStudy(item("organs","Heart",{type:"dragon",monster:"Adult White Dragon"}),r),true);
  assert.equal(canStudy(item("organs","Heart",{type:"dragon",monster:"Adult Silver Dragon"}),r),true);
  assert.equal(canStudy(item("organs","Heart",{type:"giant",monster:"Winter Troll"}),r),true);
  assert.equal(canStudy(item("organs","Heart",{type:"beast",monster:"Bear",sourceTraits:{coldImmune:true}}),r),true);
  assert.equal(canStudy(item("organs","Heart",{type:"beast",monster:"Bear",sourceTraits:{coldImmune:false}}),r),false);
});
test("ânimas com condições especiais exigem evidência positiva no componente estudado",()=>{
  const lightning=recipe("Bracers of Arc Lightning"),shapechanger=recipe("Mask of Monstrous Forms");
  assert.equal(canStudy(item("animus","Animus"),lightning),false);assert.equal(canStudy(item("animus","Animus",{sourceTraits:{dealsLightning:true}}),lightning),true);
  assert.equal(canStudy(item("animus","Animus"),shapechanger),false);assert.equal(canStudy(item("animus","Animus",{sourceTraits:{shapechanger:true}}),shapechanger),true);
});
test("características estruturadas são extraídas da ficha e preservadas na coleta",()=>{
  const actor={system:{traits:{di:{value:new Set(["cold"])}}},items:new Map([["trait",{name:"Metamorfo",system:{identifier:"shapechanger"}}],["attack",{system:{activities:{bolt:{damage:{parts:[{types:new Set(["lightning"])}]}}}}}]])};
  const sourceTraits=sourceTraitsFromActor(actor);assert.deepEqual(sourceTraits,{coldImmune:true,shapechanger:true,dealsLightning:true});
  const component=componentData({monster:{name:"Test",type:"monstrosity",sourceTraits},part:{category:"animus",part:"Animus",name:"Ânima"},rarity:"rare"});
  assert.deepEqual(component.flags[ID].sourceTraits,sourceTraits);
  assert.equal(canStudy(component,recipe("Bracers of Arc Lightning")),true);
});
test("pool exclui todas as conhecidas e inclui cada receita uma única vez",()=>{
  const component=item("fluid","Elemental Fluid"),candidates=studyCandidates(component,all);
  assert.ok(candidates.length>1);assert.equal(new Set(candidates.map(r=>r.id)).size,candidates.length);
  assert.deepEqual(studyCandidates(component,[...all,...all],candidates.map(r=>r.id)),[]);
  assert.equal(studyCandidates(component,[...all,...all]).length,candidates.length);
});
test("sorteio de um componente consegue escolher tanto a receita genérica quanto a específica",()=>{
  const generic=recipe("Talon Gloves"),specific=recipe("Rat Tooth Dagger"),component=item("natural","Claws");
  const a=drawStudyRecipes([component],[generic,specific],[],()=>0),b=drawStudyRecipes([component],[generic,specific],[],()=>.999999);
  assert.deepEqual(new Set([a[0].recipeId,b[0].recipeId]),new Set([generic.id,specific.id]));
});
test("sorteio não favorece uma receita por aceitar o material em vários requisitos",()=>{
  const once={id:"once",rarity:"rare",requirements:[{category:"organs",raw:"Any Organ"}]},twice={id:"twice",rarity:"rare",requirements:[{category:"organs",raw:"Any Organ"},{category:"organs",raw:"Heart"}]};
  assert.equal(studyCandidates(item("organs","Heart"),[once,twice]).length,2);
});
test("sorteios em lote evitam repetição e não bloqueiam descobertas por sobreposição",()=>{
  const generic={id:"generic",rarity:"rare",requirements:[{category:"natural",raw:"Any Natural Weapon"}]},specific={id:"specific",rarity:"rare",requirements:[{category:"natural",raw:"Claws from a Ratling"}]};
  const items=[item("natural","Claws",{id:"rat"}),item("natural","Claws",{id:"troll",type:"giant",monster:"Troll"})];
  for(const random of [()=>0,()=>.25,()=>.75,()=>.999999]){
    const draws=drawStudyRecipes(items,[generic,specific],[],random);assert.equal(draws.length,2);assert.equal(draws.find(d=>d.itemId==="rat").recipeId,"specific");assert.equal(draws.find(d=>d.itemId==="troll").recipeId,"generic");
  }
});
test("pool vazio e componentes esgotados não sorteiam receitas conhecidas",()=>{
  const component=item("natural","Claws"),known=all.map(r=>r.id);assert.deepEqual(drawStudyRecipes([component],all,known),[]);
  component.system.quantity=0;assert.deepEqual(drawStudyRecipes([component],all),[]);
});
