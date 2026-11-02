import {ID,escapeHTML as e} from "./core.mjs";
import {openHarvestConfig} from "./harvest-ui.mjs";
import {isDefeatedEnemy,harvestProfile} from "./harvest.mjs";
import {openLoot} from "./player-ui.mjs";

let controller,menu;
const report=error=>{console.error(`${ID} |`,error);ui.notifications.error(error.message??String(error));};
export function closeTokenMenu(){menu?.remove();menu=null;}
function tokenAt(event){
  const point=canvas.canvasCoordinatesFromClient({x:event.clientX,y:event.clientY});
  const hover=canvas.tokens.hover;
  const candidates=[...new Set([hover,...[...canvas.tokens.placeables].reverse()].filter(Boolean))];
  return candidates.find(token=>!token.isPreview && token.isVisible!==false && token.visible!==false && (game.user.isGM || !token.document.hidden) && (token.shape?.contains?token.shape.contains(point.x-token.x,point.y-token.y):token.bounds?.contains(point.x,point.y)));
}
export function openTokenHarvest(token){return openLoot(token);}
export function configureTokenHarvest(token,options){return openHarvestConfig(token,options);}
export function installTokenMenu(){
  controller?.abort();controller=new AbortController();closeTokenMenu();
  const view=globalThis.canvas?.app?.view;if(!view)return;
  let down,dragged=false;
  view.addEventListener("pointerdown",event=>{if(event.button===2){down={x:event.clientX,y:event.clientY};dragged=false;}},{capture:true,signal:controller.signal});
  view.addEventListener("pointermove",event=>{if(down && event.buttons&2 && Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)dragged=true;},{capture:true,signal:controller.signal});
  view.addEventListener("contextmenu",event=>{
    closeTokenMenu();
    if(game.user.isGM || dragged || canvas.activeLayer!==canvas.tokens || canvas.controls?.ruler?.active)return;
    const token=tokenAt(event);
    if(!token || !isDefeatedEnemy(token.document))return;
    event.preventDefault();
    menu=document.createElement("div");menu.className="selos-token-menu";menu.setAttribute("role","menu");menu.setAttribute("aria-label","Componentes da criatura");
    const add=(text,icon,action)=>{
      const button=document.createElement("button");button.type="button";button.setAttribute("role","menuitem");
      button.innerHTML=`<i class="fa-solid ${icon}" aria-hidden="true"></i> ${text}`;
      button.addEventListener("click",()=>{closeTokenMenu();Promise.resolve().then(action).catch(report);});menu.append(button);
    };
    add("Coletar componente","fa-screwdriver-wrench",()=>openTokenHarvest(token.document));
    document.body.append(menu);
    const bounds=menu.getBoundingClientRect();menu.style.left=`${Math.max(0,Math.min(event.clientX,innerWidth-bounds.width-8))}px`;menu.style.top=`${Math.max(0,Math.min(event.clientY,innerHeight-bounds.height-8))}px`;
    menu.querySelector("button").focus();
  },{capture:true,signal:controller.signal});
  document.addEventListener("pointerdown",event=>{if(menu && !menu.contains(event.target))closeTokenMenu();},{capture:true,signal:controller.signal});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeTokenMenu();},{signal:controller.signal});
}
export function uninstallTokenMenu(){controller?.abort();closeTokenMenu();}
