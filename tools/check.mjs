import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";
import assert from "node:assert/strict";
const root=path.resolve(import.meta.dirname,"..");
const moduleRoot=path.join(root,"selos-de-drakkenheim");
const manifest=JSON.parse(await fs.readFile(path.join(moduleRoot,"module.json")));
assert.equal(manifest.id,"selos-de-drakkenheim");
for(const file of [...manifest.esmodules,...manifest.styles,...manifest.languages.map(l=>l.path)])await fs.access(path.join(moduleRoot,file));
for(const entry of await fs.readdir(path.join(moduleRoot,"scripts"))){
  if(!entry.endsWith(".mjs"))continue;
  const filename=path.join(moduleRoot,"scripts",entry);
  const checked=spawnSync(process.execPath,["--check",filename],{encoding:"utf8"});
  assert.equal(checked.status,0,checked.stderr);
  const source=await fs.readFile(filename,"utf8");
  for(const match of source.matchAll(/from\s+"(\.\/[^\"]+)"/g))await fs.access(path.resolve(path.dirname(filename),match[1]));
}
const catalog=JSON.parse(await fs.readFile(path.join(moduleRoot,"data","catalog.json")));
assert.equal(catalog.recipes.length,73);assert.equal(catalog.monsters.length,223);
assert.equal(catalog.sourceSha256.length,64);
console.log("Manifesto, arquivos de distribuição, imports, sintaxe e catálogo verificados.");
