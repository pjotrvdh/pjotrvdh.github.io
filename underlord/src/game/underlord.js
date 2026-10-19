// Underlord game client. Loaded by src/main.js; the page is index.html.
import config from '../config/index.js';
const W=40,H=26,N=W*H;
const ROCK=0,EARTH=1,GOLD=2,GEM=3,FLOOR=4,CLAIM=5,HEART=6,PORTAL=7,GATE=8,LAVA=9,WALL=10;
const TREAS=1,LAIR=2,HATCH=3,TRAIN=4,LIB=5;
const ROOM_IDS=['treasury','lair','hatchery','training','library']; // room codes 1..5
const STATE_EN={think:'thinking',walk:'on the move',dig:'digging',claim:'claiming ground',reinforce:'reinforcing a wall',sleep:'sleeping',eat:'eating',train:'training',study:'studying',fight:'fighting',march:'advancing',leave:'leaving',idle:'loitering',stun:'dazed from the drop',flee:'fleeing',guard:'guarding',neutral:'wandering, unaligned'};
const N4=[[1,0],[-1,0],[0,1],[0,-1]];
/* ---------- config ---------- */
// The game data comes from src/config (one file per creature, hero, room, spell and settings group).
let CFG,ECON,KINDS,ROOMS,SPELLS,WAVES,ATTRACT,PORTAL_LIMIT,HEART_CAP,TREAS_CAP,WALL_HP,ASSETS;
function applyConfig(c){
  CFG=c.settings;ECON=CFG.economy;HEART_CAP=ECON.heartCap;TREAS_CAP=ECON.treasCap;WALL_HP=CFG.walls.hp;PORTAL_LIMIT=CFG.portal.creatureLimit;
  const mk=(v,side,k)=>({n:v.name,g:k==='imp'?'':v.name[0],hp:v.hp,atk:v.attack,spd:v.speed,range:v.range,rate:v.rate,wage:v.wage||0,col:v.color,
    side:side||undefined,bounty:v.bounty||0,dig:v.dig,big:v.big?1:0,vision:v.vision||5,pool:v.pool||0,attract:v.attract||{}});
  KINDS={};
  for(const[k,v]of Object.entries(c.creatures))KINDS[k]=mk(v,0,k);
  for(const[k,v]of Object.entries(c.heroes))KINDS[k]=mk(v,1,k);
  KINDS.imp.vision=CFG.imp.vision;
  ROOMS={};ROOM_IDS.forEach((id,n)=>{const r=c.rooms[id];ROOMS[n+1]={n:r.name,cost:r.cost,col:r.color,tip:id==='treasury'?'Stores '+TREAS_CAP+' gold per tile':r.tip};});
  SPELLS={};for(const[k,v]of Object.entries(c.spells))SPELLS[k]={...v,n:v.name,req:v.research||0,cost:v.cost||0};
  WAVES=c.waves;
  ATTRACT={};
  for(const[k,v]of Object.entries(KINDS)){if(v.side||k==='imp')continue;const req=Object.entries(v.attract);
    ATTRACT[k]={need:req.length?req.map(([r,n])=>'a '+ROOMS[ROOM_IDS.indexOf(r)+1].n+' of '+n+'+ tiles').join(' and '):'a free bed in your Lair',
      ok:()=>req.every(([r,n])=>G.rc[ROOM_IDS.indexOf(r)+1]>=n)};}
  ASSETS={};for(const grp of['units','tiles','props'])for(const[k,v]of Object.entries(c.assets[grp]||{}))ASSETS[grp+'.'+k]=v;
  loadAssets();
}
const wage=k=>Math.round(KINDS[k].wage*ECON.wageMul);

/* ---------- assets ---------- */
// SVGs are rasterised once per on-screen size into a cache, so they stay sharp at every zoom level.
const IMG={},SPR=new Map();
function loadAssets(){
  for(const k in IMG)delete IMG[k];SPR.clear();
  if(typeof Image==='undefined')return;
  for(const[k,src]of Object.entries(ASSETS)){const im=new Image();im.onload=()=>{IMG[k]=im;SPR.clear();};im.src=src;}
}
function sprite(k,w,h){
  const im=IMG[k];if(!im)return null;w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));
  const key=k+'|'+w+'|'+h;let c=SPR.get(key);
  if(!c){if(SPR.size>800)SPR.clear();c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);SPR.set(key,c);}
  return c;
}
function spr(k,x,y,w,h,flip=false){
  const c=sprite(k,w*DPR,h*DPR);if(!c)return false;
  if(flip){ctx.save();ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(c,0,0,w,h);ctx.restore();}else ctx.drawImage(c,x,y,w,h);
  return true;
}
applyConfig(config);

const cv=document.getElementById('cv'), mainCtx=cv.getContext('2d'), stage=document.getElementById('stage');
const fogC=document.createElement('canvas');fogC.width=W;fogC.height=H;const fogX=fogC.getContext('2d');
const layer=document.createElement('canvas'),lctx=layer.getContext('2d');
const cloud=document.createElement('canvas'),cctx=cloud.getContext('2d');
// Drawing helpers all use `ctx`; it is pointed at an offscreen canvas while the terrain and fog caches are rendered.
let ctx=mainCtx;
const terr=document.createElement('canvas');let terrKey='',fogKey='',fogT=0;
let TS=24, BASE=24, Z=1.7, SW=600, SH=400, cam={x:0,y:0}, camInit=false, DPR=1, G=null, running=false, paused=false, speed=1, tool='hand';
let hover={x:-1,y:-1,fx:0,fy:0,in:false}, drag=null;
const rand=n=>Math.floor(Math.random()*n);
const ix=(x,y)=>y*W+x, tx=i=>i%W, ty=i=>(i/W)|0;
const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
const hash=(x,y,s=0)=>{let h=(x*374761393+y*668265263+s*982451653)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;};
const ti=e=>ix(Math.floor(e.x),Math.floor(e.y));
const walk=i=>{const t=G.t[i];return t===FLOOR||t===CLAIM||t===PORTAL||t===GATE;};
const transp=i=>{const t=G.t[i];return t===FLOOR||t===CLAIM||t===PORTAL||t===GATE||t===HEART||t===LAVA;};
const diggable=i=>{const t=G.t[i];return t===EARTH||t===GOLD||t===GEM||t===WALL;};
const nb=(i,f)=>{const x=tx(i),y=ty(i);for(const[dx,dy]of N4){const a=x+dx,b=y+dy;if(inb(a,b)&&f(ix(a,b)))return ix(a,b);}return -1;};
const adjHeart=i=>nb(i,j=>G.t[j]===HEART)>=0;
const cap=()=>HEART_CAP+TREAS_CAP*G.rc[TREAS];
const ownPortal=i=>G.t[i]===PORTAL&&!!G.pown[i];
const anyPortal=()=>G.portals.some(p=>G.pown[p]);

/* ---------- pathfinding ---------- */
function buildPath(prev,g,start){const p=[];let c=g;while(c!==start&&c>=0){p.push(c);c=prev[c];}return p.reverse();}
function bfs(start,goal,k=1,pass=walk,maxLen=1e9){
  const m=[];if(goal(start))m.push(start);
  const prev=new Int32Array(N).fill(-2);prev[start]=-1;const q=[start],dep=new Int16Array(N);let h=0;
  while(h<q.length&&m.length<k){const c=q[h++];if(dep[c]>=maxLen)continue;const x=tx(c),y=ty(c);
    for(const[dx,dy]of N4){const a=x+dx,b=y+dy;if(!inb(a,b))continue;const n=ix(a,b);if(prev[n]!==-2||!pass(n))continue;prev[n]=c;dep[n]=dep[c]+1;q.push(n);if(goal(n)){m.push(n);if(m.length>=k)break;}}}
  if(!m.length)return null;const g=m[rand(m.length)];return g===start?[]:buildPath(prev,g,start);
}
function hcost(i){if(walk(i))return 1;const t=G.t[i];return t===EARTH?4:t===GOLD?6:t===WALL?12:-1;}
function dijkstra(start,goal){
  const dist=new Float32Array(N).fill(1e9),prev=new Int32Array(N).fill(-1),hp=[];
  const push=(d,i)=>{hp.push([d,i]);let c=hp.length-1;while(c>0){const p=(c-1)>>1;if(hp[p][0]<=hp[c][0])break;[hp[p],hp[c]]=[hp[c],hp[p]];c=p;}};
  const pop=()=>{const top=hp[0],l=hp.pop();if(hp.length){hp[0]=l;let c=0;for(;;){const a=2*c+1,b=a+1;let s=c;if(a<hp.length&&hp[a][0]<hp[s][0])s=a;if(b<hp.length&&hp[b][0]<hp[s][0])s=b;if(s===c)break;[hp[s],hp[c]]=[hp[c],hp[s]];c=s;}}return top;};
  dist[start]=0;push(0,start);
  while(hp.length){const[d,c]=pop();if(d>dist[c])continue;if(goal(c))return buildPath(prev,c,start);
    const x=tx(c),y=ty(c);for(const[dx,dy]of N4){const a=x+dx,b=y+dy;if(!inb(a,b))continue;const n=ix(a,b),k=hcost(n);if(k<0)continue;if(d+k<dist[n]){dist[n]=d+k;prev[n]=c;push(d+k,n);}}}
  return null;
}

/* ---------- map ---------- */
function genMap(){
  let caves=[];
  for(let tries=0;tries<40;tries++){
    const t=new Uint8Array(N).fill(EARTH);caves=[];
    for(let x=0;x<W;x++){t[ix(x,0)]=ROCK;t[ix(x,H-1)]=ROCK;}
    for(let y=0;y<H;y++){t[ix(0,y)]=ROCK;t[ix(W-1,y)]=ROCK;}
    const blob=(type,n,len)=>{for(let k=0;k<n;k++){let x=2+rand(W-4),y=2+rand(H-4);for(let s=0;s<len;s++){if(x>0&&y>0&&x<W-1&&y<H-1)t[ix(x,y)]=type;const[dx,dy]=N4[rand(4)];x+=dx;y+=dy;}}};
    blob(GOLD,ECON.goldVeins,7);blob(LAVA,2,5);
    for(let k=0;k<2;k++)t[ix(16+rand(18),3+rand(H-6))]=GEM;
    const hx=5,hy=H>>1;
    // hidden caverns
    for(let k=0;k<5;k++){
      let cx=0,cy=0,ok=false;
      for(let a=0;a<30&&!ok;a++){cx=13+rand(W-20);cy=3+rand(H-6);ok=caves.every(c=>Math.hypot(c.x-cx,c.y-cy)>7);}
      const cells=[];let x=cx,y=cy;
      for(let s=0;s<14;s++){for(const[dx,dy]of[[0,0],[1,0],[0,1],[1,1]]){const a=x+dx,b=y+dy;if(a>1&&b>1&&a<W-2&&b<H-2){t[ix(a,b)]=FLOOR;cells.push(ix(a,b));}}
        const[dx,dy]=N4[rand(4)];x=Math.max(2,Math.min(W-4,x+dx));y=Math.max(2,Math.min(H-4,y+dy));}
      caves.push({x:cx,y:cy,cells});
    }
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=hx+dx,y=hy+dy;if(x>0&&y>0&&x<W-1&&y<H-1)t[ix(x,y)]=EARTH;}
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const x=hx+dx,y=hy+dy;if(x>0&&y>0)t[ix(x,y)]=(Math.abs(dx)<=1&&Math.abs(dy)<=1)?HEART:CLAIM;}
    for(let y=hy-2;y<=hy+1;y++)t[ix(hx+5,y)]=GOLD;
    // One portal, a short tunnel from the Heart: above or below it, just past the gold seam.
    const up=Math.random()<.5,portals=[];
    {const x=12+rand(3),y=hy+(up?-1:1)*(4+rand(3));
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)t[ix(x+dx,y+dy)]=FLOOR;t[ix(x,y)]=PORTAL;portals.push(ix(x,y));}
    const gx=W-4,gy=4+rand(H-8);
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)t[ix(gx+dx,gy+dy)]=FLOOR;
    t[ix(gx,gy)]=GATE;
    G.t=t;G.hx=hx;G.hy=hy;G.portals=portals;G.portal=portals[0];G.gate=ix(gx,gy);
    if(dijkstra(G.gate,i=>adjHeart(i)))break;
  }
  for(let i=0;i<N;i++){G.hp[i]=G.t[i]===GOLD?5:3;G.gold[i]=G.t[i]===GOLD?ECON.seamGold:0;}
  // populate the caverns (hero camp in the one farthest from the heart)
  caves.sort((a,b)=>Math.hypot(b.x-G.hx,b.y-G.hy)-Math.hypot(a.x-G.hx,a.y-G.hy));
  caves.forEach((c,k)=>{
    const cells=[...new Set(c.cells)].filter(i=>G.t[i]===FLOOR&&Math.hypot(tx(i)-tx(G.gate),ty(i)-ty(G.gate))>4);
    if(cells.length<3)return;
    const pick=()=>cells.splice(rand(cells.length),1)[0];
    if(k===0){const a=pick(),b=pick();G.loot[pick()]=600;
      for(const[kind,i]of[['knight',a],['archer',b]]){const e=spawn(kind,tx(i),ty(i));e.guard=true;e.state='guard';}}
    else if(k<=2){const i=pick();const e=spawn(k===1?'orc':'troll',tx(i),ty(i));e.side=2;e.state='neutral';G.loot[pick()]=200;}
    else{G.loot[pick()]=250;G.loot[pick()]=150;}
  });
}

function newGame(){
  G={t:null,room:new Uint8Array(N),mark:new Uint8Array(N),hp:new Uint8Array(N),gold:new Int16Array(N),seen:new Uint8Array(N),loot:new Int16Array(N),
     res:new Map(),rc:[0,0,0,0,0,0],ents:[],fx:[],money:ECON.startGold,heartHP:CFG.heart.hp,heartMax:CFG.heart.hp,heartFlash:0,
     time:0,nextWave:CFG.waves.first,zapT:0,wave:0,spawnQ:[],research:0,payT:ECON.payInterval,pown:new Uint8Array(N),pool:Object.fromEntries(Object.keys(ATTRACT).map(k=>[k,KINDS[k].pool])),portalT:CFG.portal.firstArrival,idc:1,
     held:[],over:null,rally:null,msgCd:{},visT:0,cpu:{on:!!(G&&G.cpu&&G.cpu.on),mode:(G&&G.cpu&&G.cpu.mode)||'defensive',t:0}};
  genMap();
  const ring=[];for(let i=0;i<N;i++)if(G.t[i]===CLAIM)ring.push(i);
  for(let k=0;k<CFG.imp.startCount;k++){const i=ring[rand(ring.length)];spawn('imp',tx(i),ty(i));}
  for(let i=0;i<N;i++)if(Math.hypot(tx(i)-G.hx,ty(i)-G.hy)<=4.3||G.portals.some(p=>Math.abs(tx(i)-tx(p))<=1&&Math.abs(ty(i)-ty(p))<=1))G.seen[i]=1;
  vision();
  document.getElementById('log').innerHTML='';
  msg('A portal glows in the dark near your Heart. Dig a tunnel and claim it to attract creatures.');
  msg('Click or drag over earth to mark it for digging.');
  msg('Build a Treasury: your Heart holds only '+HEART_CAP+' gold.');
  if(camInit)centerOn(G.hx,G.hy);
  syncCpu();
}

/* ---------- vision ---------- */
const VIS={};
function offsets(R){if(VIS[R])return VIS[R];const o=[];for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++)if(dx*dx+dy*dy<=R*R+.5)o.push([dx,dy]);return VIS[R]=o;}
function los(x0,y0,x1,y1){
  const dx=x1-x0,dy=y1-y0,n=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))*3);
  for(let k=1;k<n;k++){const x=Math.floor(x0+.5+dx*k/n),y=Math.floor(y0+.5+dy*k/n);if(x===x1&&y===y1)return true;if(x===x0&&y===y0)continue;if(!transp(ix(x,y)))return false;}
  return true;
}
function vision(){
  let dirty=false;
  for(const e of G.ents){
    if(e.dead||e.held||e.side!==0)continue;
    const cx=Math.floor(e.x),cy=Math.floor(e.y);
    for(const[dx,dy]of offsets(KINDS[e.kind].vision)){const x=cx+dx,y=cy+dy;if(!inb(x,y))continue;const i=ix(x,y);if(G.seen[i])continue;if(los(cx,cy,x,y)){G.seen[i]=1;dirty=true;}}
  }
  for(const n of G.ents){
    if(n.side!==2||n.dead||!G.seen[ti(n)])continue;
    if(G.ents.some(o=>o.side===0&&!o.held&&!o.dead&&Math.hypot(o.x-n.x,o.y-n.y)<3)){
      n.side=0;n.state='think';fx({type:'ring',x:n.x,y:n.y,dur:.8,col:'#e0483c'});msg('A wandering '+KINDS[n.kind].n+' joins your dungeon.','join'+n.id,'good');}
  }
  if(dirty)G.fogDirty=true;
}
function rebuildFog(){
  const img=fogX.createImageData(W,H);
  for(let i=0;i<N;i++){img.data[i*4+3]=G.seen[i]?0:255;}
  fogX.putImageData(img,0,0);G.fogDirty=false;
}

/* ---------- entities ---------- */
function spawn(kind,x,y,mult=1){
  const k=KINDS[kind];
  const e={id:G.idc++,kind,side:k.side||0,x:x+.5,y:y+.5,hp:k.hp*mult,maxhp:k.hp*mult,atk:k.atk*mult,lvl:1,xp:0,
    state:k.side?'march':'think',path:[],next:null,nextT:0,timer:0,cd:0,carry:0,hunger:Math.random()*40,slap:0,
    resv:-1,bed:-1,target:null,repath:0,scan:Math.random()*.5,ignoreT:0,dead:false,held:false,face:1,task:-1,guard:false};
  G.ents.push(e);return e;
}
function reserve(e,i){e.resv=i;G.res.set(i,(G.res.get(i)||0)+1);}
function release(e){if(e.resv>=0){const c=(G.res.get(e.resv)||1)-1;if(c>0)G.res.set(e.resv,c);else G.res.delete(e.resv);e.resv=-1;}}
function go(e,path,next,t=0){e.path=path;e.next=next;e.nextT=t;e.state='walk';}
function step(e,dt){
  if(!e.path.length)return true;
  const n=e.path[0],cx=tx(n)+.5,cy=ty(n)+.5,dx=cx-e.x,dy=cy-e.y,d=Math.hypot(dx,dy);
  const sp=KINDS[e.kind].spd*(e.slap>0?SLAP_BOOST:1)*dt;
  if(Math.abs(dx)>.01)e.face=Math.sign(dx);
  if(d<=sp){e.x=cx;e.y=cy;e.path.shift();return !e.path.length;}
  e.x+=dx/d*sp;e.y+=dy/d*sp;return false;
}
function arrive(e){
  e.state=e.next;e.timer=e.nextT;
  if(e.state==='deposit'){const add=addGold(e.carry);e.carry-=add;if(e.carry>0)msg('Your treasuries are full. Build more.','full','bad');e.state='think';}
}
function addGold(n){const a=Math.max(0,Math.min(n,cap()-G.money));G.money+=a;return a;}
function openTile(j){G.t[j]=FLOOR;G.mark[j]=0;}

function digTarget(i,allowGold){
  let best=-1,bc=9;const x=tx(i),y=ty(i);
  for(const[dx,dy]of N4){const a=x+dx,b=y+dy;if(!inb(a,b))continue;const j=ix(a,b);
    if(!G.mark[j]||!diggable(j))continue;if(!allowGold&&G.t[j]!==EARTH)continue;
    const c=G.res.get(j)||0;if(c<2&&c<bc){bc=c;best=j;}}
  return best;
}
const depositGoal=i=>walk(i)&&(G.room[i]===TREAS||adjHeart(i));
function impThink(e){
  release(e);const here=ti(e),full=G.money>=cap();
  if(e.carry>=100&&!full){const p=bfs(here,depositGoal);if(p){go(e,p,'deposit');return;}}
  const claimable=i=>(G.t[i]===FLOOR||(G.t[i]===PORTAL&&!G.pown[i]))&&!G.res.has(i)&&nb(i,j=>G.t[j]===CLAIM)>=0;
  let p=bfs(here,claimable,1,walk,2);
  if(p){const end=p.length?p[p.length-1]:here;reserve(e,end);e.task=end;go(e,p,'claim',1.2);return;}
  const allowGold=!(full&&e.carry>=100);
  p=bfs(here,i=>digTarget(i,allowGold)>=0);
  if(p){const end=p.length?p[p.length-1]:here,j=digTarget(end,allowGold);reserve(e,j);e.task=j;go(e,p,'dig',.15);return;}
  if(e.carry>0&&!full){p=bfs(here,depositGoal);if(p){go(e,p,'deposit');return;}}
  p=bfs(here,i=>(G.t[i]===FLOOR||(G.t[i]===PORTAL&&!G.pown[i]))&&!G.res.has(i)&&nb(i,j=>G.t[j]===CLAIM)>=0);
  if(p){const end=p.length?p[p.length-1]:here;reserve(e,end);e.task=end;go(e,p,'claim',1.2);return;}
  p=bfs(here,i=>G.loot[i]>0,1,walk,30);
  if(p){go(e,p,'idle',.5);return;}
  p=bfs(here,i=>G.t[i]===CLAIM&&reinforceTarget(i)>=0,1,walk,40);
  if(p){const end=p.length?p[p.length-1]:here,j=reinforceTarget(end);reserve(e,j);e.task=j;go(e,p,'reinforce',.5);return;}
  p=bfs(here,i=>G.t[i]===CLAIM&&!G.room[i],6,walk,4);
  if(p&&Math.random()<.5)go(e,p,'idle',1+Math.random()*1.5);else{e.state='idle';e.timer=.8+Math.random();}
}
function doDig(e,dt){
  const j=e.task;
  if(j<0||!G.mark[j]||!diggable(j)||nb(ti(e),k=>k===j)<0){e.state='think';return;}
  e.face=Math.sign(tx(j)-tx(ti(e)))||e.face;
  e.timer-=dt*(e.slap>0?SLAP_BOOST:1);if(e.timer>0)return;e.timer=.38;
  const t=G.t[j];
  if(t===EARTH||t===WALL){if(--G.hp[j]<=0)openTile(j);}
  else if(t===GOLD){const g=Math.min(20,G.gold[j]);G.gold[j]-=g;e.carry+=g;if(G.gold[j]<=0)openTile(j);}
  else if(t===GEM){e.carry+=20;}
  fx({type:'dust',x:(e.x+tx(j)+.5)/2,y:(e.y+ty(j)+.5)/2,dur:.35,col:t===EARTH?'#8a6446':t===WALL?'#9a8a80':'#f2cb55'});
  if(e.carry>=100&&(G.money<cap()||t!==EARTH))e.state='think';
}
// Idle imps fortify earth walls that border your territory (as in Dungeon Keeper).
function reinforceTarget(i){return nb(i,j=>G.t[j]===EARTH&&!G.mark[j]&&!G.res.has(j));}
function doReinforce(e,dt){
  const j=e.task;
  if(j<0||G.t[j]!==EARTH||G.mark[j]||G.t[ti(e)]!==CLAIM||nb(ti(e),k=>k===j)<0){e.state='think';return;}
  e.face=Math.sign(tx(j)-tx(ti(e)))||e.face;
  e.timer-=dt*(e.slap>0?SLAP_BOOST:1);if(e.timer>0)return;e.timer=.5;
  e.work=(e.work||0)+1;fx({type:'dust',x:(e.x+tx(j)+.5)/2,y:(e.y+ty(j)+.5)/2,dur:.3,col:'#b8a89a'});
  if(e.work>=5){e.work=0;G.t[j]=WALL;G.hp[j]=WALL_HP;e.state='think';}
}
function doClaim(e,dt){
  const i=ti(e);
  if(i!==e.task||!(G.t[i]===FLOOR||(G.t[i]===PORTAL&&!G.pown[i]))){e.state='think';return;}
  e.timer-=dt*(e.slap>0?SLAP_BOOST:1);if(e.timer>0)return;
  if(nb(i,j=>G.t[j]===CLAIM)>=0){
    if(G.t[i]===PORTAL){G.pown[i]=1;msg('A portal is yours. Creatures can now arrive through it.','portal'+i,'good');}
    else G.t[i]=CLAIM;
    fx({type:'ring',x:tx(i)+.5,y:ty(i)+.5,dur:.5,col:'#e0483c'});
  }
  e.state='think';
}

function creatures(){return G.ents.filter(e=>e.side===0&&e.kind!=='imp'&&!e.dead);}
// Beds (Dungeon Keeper style): every creature claims one Lair tile as its own bed. Nobody else sleeps there,
// and the bed is freed when the creature dies or leaves, or when the tile stops being a Lair.
function bedOwner(i,except){return G.ents.find(o=>o!==except&&!o.dead&&o.side===0&&o.bed===i);}
function hasBed(e){return e.bed>=0&&G.room[e.bed]===LAIR;}
function toBed(e){
  const here=ti(e);if(!hasBed(e))e.bed=-1;
  if(e.bed>=0)return bfs(here,i=>i===e.bed);
  if(!G.rc[LAIR])return null;
  const p=bfs(here,i=>G.room[i]===LAIR&&!bedOwner(i,e));
  if(p)e.bed=p.length?p[p.length-1]:here;
  return p;
}
const frontier=i=>nb(i,j=>!G.seen[j])>=0;
function creatureThink(e){
  release(e);const here=ti(e);
  if(G.rally&&G.time<G.rally.until){const p=bfs(here,i=>i===G.rally.i);if(p){go(e,p,'idle',1);return;}}
  if(e.hp<e.maxhp*.5){const p=toBed(e);if(p){go(e,p,'sleep');return;}}
  if(e.hunger>=100&&G.rc[HATCH]){const p=bfs(here,i=>G.room[i]===HATCH,6);if(p){go(e,p,'eat',2.5);return;}}
  if(e.kind==='warlock'&&G.rc[LIB]&&Math.random()<.8){const p=bfs(here,i=>G.room[i]===LIB,6);if(p){go(e,p,'study',8);return;}}
  if(G.rc[TRAIN]&&G.money>20&&e.lvl<10&&Math.random()<.6){const p=bfs(here,i=>G.room[i]===TRAIN,6);if(p){go(e,p,'train',8);return;}}
  if(Math.random()<.35){const p=bfs(here,i=>frontier(i)||G.loot[i]>0,3,walk,40);if(p&&p.length){go(e,p,'idle',1.5);return;}}
  if(G.rc[LIB]&&Math.random()<.5){const p=bfs(here,i=>G.room[i]===LIB,6);if(p){go(e,p,'study',8);return;}}
  let p=toBed(e);
  if(!p)p=bfs(here,i=>G.t[i]===CLAIM,8,walk,5);
  if(p)go(e,p,'idle',2+Math.random()*3);else{e.state='idle';e.timer=2;}
}
function need(e){return 80*e.lvl;}
function gainXP(e,n){if(e.lvl>=10)return;e.xp+=n;while(e.lvl<10&&e.xp>=need(e)){e.xp-=need(e);e.lvl++;e.maxhp*=1.12;e.hp=e.maxhp;e.atk*=1.1;fx({type:'text',x:e.x,y:e.y-.4,dur:1.2,txt:'Level '+e.lvl,col:'#e3b23c'});}}
function research(n){
  const before=G.research;G.research+=n;
  for(const[k,s]of Object.entries(SPELLS))if(s.req&&before<s.req&&G.research>=s.req)msg('Research complete: '+s.n+'.','sp'+k,'good');
}
function leave(e,why){
  release(e);e.target=null;
  const p=bfs(ti(e),ownPortal);
  msg('The '+KINDS[e.kind].n+' leaves your dungeon ('+why+').','lv'+e.id,'bad');
  if(!p){e.dead=true;toPool(e);return;}
  e.path=p;e.state='leave';
}
function clearShot(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)*5));
  let px=Math.floor(a.x),py=Math.floor(a.y);
  for(let k=1;k<=n;k++){const x=Math.floor(a.x+dx*k/n),y=Math.floor(a.y+dy*k/n);
    if(x===px&&y===py)continue;
    if(!inb(x,y)||!transp(ix(x,y)))return false;
    if(x!==px&&y!==py&&!transp(ix(x,py))&&!transp(ix(px,y)))return false;
    px=x;py=y;}
  return true;
}
function nearestEnemy(e,R){
  let best=null,bd=R*R;
  for(const o of G.ents){if(o.dead||o.held||o.side===e.side||o.side===2)continue;const dx=o.x-e.x,dy=o.y-e.y,d=dx*dx+dy*dy;if(d<bd&&clearShot(e,o)){bd=d;best=o;}}
  return best;
}
function attack(e,t){
  const k=KINDS[e.kind],dmg=e.atk*(.85+Math.random()*.3);
  if(k.range>1.5)fx({type:'proj',x:e.x,y:e.y,x1:t.x,y1:t.y,dur:.25,col:e.side?'#bcd2f0':'#c58cff'});
  else fx({type:'dust',x:(e.x+t.x)/2,y:(e.y+t.y)/2,dur:.25,col:'#ffffff'});
  t.hp-=dmg;
  if(e.side===0)gainXP(e,dmg*.4);
  if(t.side===0&&t.kind!=='imp'&&t.state==='sleep')t.state='think';
  if(t.hp<=0)kill(t);
}
function kill(t){
  t.dead=true;release(t);
  if(t.side===1){const k=KINDS[t.kind],a=addGold(Math.round(k.bounty*ECON.bountyMul));fx({type:'text',x:t.x,y:t.y,dur:1.2,txt:'+'+a,col:'#e3b23c'});
    if(t.kind==='lord')msg('The Lord of the Land has fallen!','lord','good');}
  else{toPool(t);msg((t.kind==='imp'?'An imp':'Your '+KINDS[t.kind].n)+' has been slain.','die'+t.id,'bad');}
}
function fight(e,dt){
  const t=e.target;
  if(!t||t.dead||t.held||t.side===e.side){e.state='think';e.target=null;return;}
  const k=KINDS[e.kind],d=Math.hypot(t.x-e.x,t.y-e.y);
  if(d>13){e.state='think';e.target=null;return;}
  if(d<=k.range+.35&&clearShot(e,t)){e.path=[];e.face=Math.sign(t.x-e.x)||e.face;if(e.cd<=0){attack(e,t);e.cd=k.rate;}return;}
  e.repath-=dt;
  if(e.repath<=0||!e.path.length){e.repath=.6;const g=ti(t);const p=bfs(ti(e),i=>i===g,1,walk,22);
    if(!p){e.state='think';e.target=null;e.ignoreT=G.time+3;return;}e.path=p;}
  step(e,dt);
}
function march(e,dt){
  const here=ti(e);
  if(adjHeart(here)){if(e.cd<=0){e.cd=KINDS[e.kind].rate;G.heartHP-=e.atk;G.heartFlash=.25;
    fx({type:'dust',x:G.hx+.5+(e.x-G.hx-.5)*.4,y:G.hy+.5+(e.y-G.hy-.5)*.4,dur:.3,col:'#ff6a4a'});
    msg('Your Dungeon Heart is under attack!','heart','bad');}return;}
  e.repath-=dt;
  if(!e.path.length||e.repath<=0){e.repath=5;e.path=dijkstra(here,i=>adjHeart(i))||[];}
  const n=e.path[0];if(n===undefined)return;
  if(!walk(n)){
    if(!diggable(n)){e.path=[];return;}
    e.face=Math.sign(tx(n)-tx(here))||e.face;
    e.timer-=dt;if(e.timer>0)return;e.timer=KINDS[e.kind].dig;
    if(G.hp[n]>0)G.hp[n]--;if(G.hp[n]<=0)openTile(n);
    fx({type:'dust',x:(e.x+tx(n)+.5)/2,y:(e.y+ty(n)+.5)/2,dur:.35,col:'#8a6446'});return;
  }
  step(e,dt);
}

function tick(e,dt){
  if(e.side===2)return;
  e.cd-=dt;if(e.slap>0)e.slap-=dt;
  if(e.side===0){const i=ti(e);if(G.loot[i]>0){const a=addGold(G.loot[i]);if(a>0){G.loot[i]-=a;fx({type:'text',x:e.x,y:e.y-.3,dur:1.2,txt:'+'+a,col:'#e3b23c'});msg('Treasure found: '+a+' gold.','loot'+i,'good');}}}
  if(e.side===0&&e.kind!=='imp'){e.hunger+=dt*1.5;if(e.hunger>=200&&e.state!=='leave'){e.hunger=0;leave(e,'starving');}}
  if(e.kind==='imp'&&e.state!=='flee'){e.scan-=dt;if(e.scan<=0){e.scan=.5;const o=nearestEnemy(e,3.2);
    if(o){release(e);const p=bfs(ti(e),i=>adjHeart(i)&&Math.hypot(tx(i)-o.x,ty(i)-o.y)>3,1);if(p&&p.length){go(e,p,'idle',3);e.state='flee';}}}}
  if(e.kind!=='imp'&&e.state!=='fight'&&e.state!=='leave'){
    e.scan-=dt;if(e.scan<=0){e.scan=.5;if(G.time>=e.ignoreT){const o=nearestEnemy(e,e.side?5:8);if(o){release(e);e.state='fight';e.target=o;e.path=[];e.repath=0;}}}
  }
  switch(e.state){
    case 'stun':if((e.timer-=dt)<=0){if(e.after){e.state=e.after[0];e.timer=e.after[1];e.after=null;}else e.state='think';}break;
    case 'think':e.boost=1;if(e.side){if(e.guard){e.state='guard';}else{e.state='march';e.path=[];e.repath=0;}}else if(e.kind==='imp')impThink(e);else creatureThink(e);break;
    case 'guard':break;
    case 'walk':case 'flee':if(step(e,dt))arrive(e);break;
    case 'idle':if((e.timer-=dt)<=0)e.state='think';break;
    case 'dig':doDig(e,dt);break;
    case 'claim':doClaim(e,dt);break;
    case 'reinforce':doReinforce(e,dt);break;
    case 'sleep':if(ti(e)!==e.bed||!hasBed(e)){e.state='think';break;}e.hp=Math.min(e.maxhp,e.hp+e.maxhp*.06*dt);if(e.hp>=e.maxhp)e.state='think';break;
    case 'eat':if(G.room[ti(e)]!==HATCH){e.state='think';break;}if((e.timer-=dt)<=0){e.hunger=0;e.hp=Math.min(e.maxhp,e.hp+e.maxhp*.15);e.state='think';}break;
    case 'train':if(G.room[ti(e)]!==TRAIN||G.money<=0){e.state='think';break;}G.money=Math.max(0,G.money-ECON.trainCost*dt);gainXP(e,(e.kind==='troll'?11:9)*(e.boost||1)*dt);if((e.timer-=dt)<=0)e.state='think';break;
    case 'study':if(G.room[ti(e)]!==LIB){e.state='think';break;}research(dt*(e.kind==='warlock'?4:1.2)*(e.boost||1));if((e.timer-=dt)<=0)e.state='think';break;
    case 'fight':fight(e,dt);break;
    case 'march':march(e,dt);break;
    case 'leave':if(step(e,dt)){e.dead=true;toPool(e);fx({type:'ring',x:e.x,y:e.y,dur:.6,col:'#9b6bf0'});}break;
    default:e.state='think';
  }
}

function toPool(e){if(e.side===0&&G.pool[e.kind]!==undefined)G.pool[e.kind]++;}
function tryAttract(){
  const n=creatures().length+G.held.filter(e=>e.kind!=='imp').length;
  if(n>=PORTAL_LIMIT){msg('Your dungeon has reached its creature limit of '+PORTAL_LIMIT+'.','limit','bad');return;}
  if(G.rc[LAIR]<=n){msg('Your creatures need a bigger Lair. The portal stays quiet until there is a free bed.','nolair','bad');return;}
  const opts=Object.keys(ATTRACT).filter(k=>G.pool[k]>0&&ATTRACT[k].ok());
  if(!opts.length)return;
  const k=opts[rand(opts.length)],own=G.portals.filter(p=>G.pown[p]),pt=own[rand(own.length)];G.pool[k]--;
  const e=spawn(k,tx(pt),ty(pt));
  fx({type:'ring',x:e.x,y:e.y,dur:.8,col:'#c58cff'});
  msg('A '+KINDS[k].n+' steps through the portal.','arr'+e.id,'good');
}
function payday(){
  let paid=0,gone=0;
  for(const e of creatures()){if(e.state==='leave')continue;const w=wage(e.kind);
    if(G.money>=w){G.money-=w;paid+=w;fx({type:'text',x:e.x,y:e.y-.4,dur:1,txt:'-'+w,col:'#e3b23c'});}else{gone++;leave(e,'unpaid');}}
  if(paid||gone)msg('Payday: '+paid+' gold paid out'+(gone?', '+gone+' went unpaid.':'.'),'pay'+G.time,gone?'bad':'');
}
function banner(text){const b=document.getElementById('banner');b.textContent=text;b.classList.add('show');setTimeout(()=>b.classList.remove('show'),2600);}
function launchWave(){
  const w=WAVES[G.wave];G.wave++;let d=0;
  for(const[k,c]of Object.entries(w))for(let i=0;i<c;i++){G.spawnQ.push({k,t:d});d+=1.2;}
  msg('Wave '+G.wave+': heroes are invading your realm!','wave'+G.wave,'bad');
  banner(G.wave===WAVES.length?'The Lord of the Land approaches':'Heroes approach');
}

/* ---------- update ---------- */
function update(dt){
  if(G.over)return;
  G.time+=dt;
  if(G.wave<WAVES.length){G.nextWave-=dt;if(G.nextWave<=0){launchWave();G.nextWave=CFG.waves.interval;}}
  for(const q of G.spawnQ)q.t-=dt;
  while(G.spawnQ.length&&G.spawnQ[0].t<=0){const q=G.spawnQ.shift(),e=spawn(q.k,tx(G.gate),ty(G.gate),1+CFG.waves.heroScalePerWave*(G.wave-1));fx({type:'ring',x:e.x,y:e.y,dur:.6,col:'#bcd2f0'});}
  if(anyPortal()){G.portalT-=dt;if(G.portalT<=0){G.portalT=CFG.portal.interval;tryAttract();}}
  G.payT-=dt;if(G.payT<=0){G.payT=ECON.payInterval;payday();}
  if(G.heartFlash>0)G.heartFlash-=dt;
  if((G.zapT-=dt)<=0){const c={x:G.hx+.5,y:G.hy+.5};let best=null,bd=CFG.heart.zapRange;
    for(const o of G.ents){if(o.dead||o.side!==1)continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d<bd){bd=d;best=o;}}
    if(best){G.zapT=CFG.heart.zapInterval;fx({type:'proj',x:c.x,y:c.y,x1:best.x,y1:best.y,dur:.2,col:'#ff6a4a'});best.hp-=CFG.heart.zapDamage;if(best.hp<=0)kill(best);}}
  for(const e of G.ents)if(!e.dead&&!e.held)tick(e,dt);
  G.ents=G.ents.filter(e=>!e.dead);
  if((G.visT-=dt)<=0){G.visT=.25;vision();}
  cpuTick(dt);
  for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.dur);
  if(G.heartHP<=0){G.heartHP=0;end(false);}
  else if(G.wave>=WAVES.length&&!G.spawnQ.length&&!G.ents.some(e=>e.side===1&&!e.guard))end(true);
}
function end(win){
  G.over=win?'win':'lose';
  const ov=document.getElementById('ov');
  ov.innerHTML=win
    ?'<div class="card"><h2>The surface kneels</h2><p>All six invasions are broken and the Lord of the Land lies in your dungeon. Your reign is complete.</p><div class="row"><button id="bAgain" class="main" type="button">New dungeon</button></div></div>'
    :'<div class="card"><h2>The Heart is broken</h2><p>The heroes destroyed your Dungeon Heart during wave '+G.wave+'. Dig deeper, build stronger and try again.</p><div class="row"><button id="bAgain" class="main" type="button">Try again</button><button id="bAgainLoad" type="button">Load last save</button></div></div>';
  ov.hidden=false;
  document.getElementById('bAgain').onclick=()=>{ov.hidden=true;newGame();paused=false;syncPause();};
  const l=document.getElementById('bAgainLoad');if(l)l.onclick=()=>loadGame();
}
function fx(f){f.t=0;G.fx.push(f);}
function msg(text,key,cls=''){
  if(key){const c=G.msgCd[key];if(c!==undefined&&G.time-c<20)return;G.msgCd[key]=G.time;}
  const ul=document.getElementById('log'),li=document.createElement('li');li.textContent=text;if(cls)li.className=cls;
  ul.prepend(li);while(ul.children.length>7)ul.lastChild.remove();
}

/* ---------- save / load ---------- */
const SAVE_V=2;const SAVE_KEYS=['id','kind','side','x','y','hp','maxhp','atk','lvl','xp','carry','hunger','guard','bed'];
function serialize(){
  return {v:SAVE_V,savedAt:Date.now(),
    t:Array.from(G.t),room:Array.from(G.room),mark:Array.from(G.mark),hp:Array.from(G.hp),gold:Array.from(G.gold),seen:Array.from(G.seen),loot:Array.from(G.loot),
    money:G.money,heartHP:G.heartHP,heartMax:G.heartMax,time:G.time,nextWave:G.nextWave,wave:G.wave,spawnQ:G.spawnQ,research:G.research,
    cpu:G.cpu,payT:G.payT,pown:Array.from(G.pown),pool:G.pool,portals:G.portals,portalT:G.portalT,idc:G.idc,hx:G.hx,hy:G.hy,portal:G.portal,gate:G.gate,rally:G.rally,
    ents:G.ents.concat(G.held).filter(e=>!e.dead).map(e=>{const o={};for(const k of SAVE_KEYS)o[k]=e[k];o.held=e.held;return o;})};
}
function deserialize(s){
  newGame();
  const A=(C,a)=>C.from(a);
  Object.assign(G,{t:A(Uint8Array,s.t),room:A(Uint8Array,s.room),mark:A(Uint8Array,s.mark),hp:A(Uint8Array,s.hp),gold:A(Int16Array,s.gold),seen:A(Uint8Array,s.seen),loot:A(Int16Array,s.loot),
    money:s.money,heartHP:s.heartHP,heartMax:s.heartMax,time:s.time,nextWave:s.nextWave,wave:s.wave,spawnQ:s.spawnQ||[],research:s.research,
    cpu:s.cpu||G.cpu,payT:s.payT,pown:A(Uint8Array,s.pown),pool:s.pool,portals:s.portals,portalT:s.portalT,idc:s.idc,hx:s.hx,hy:s.hy,portal:s.portal,gate:s.gate,rally:s.rally,
    ents:[],held:[],fx:[],res:new Map(),msgCd:{},over:null});
  for(const o of s.ents){const e=spawn(o.kind,0,0);G.ents.pop();Object.assign(e,o);
    e.state=e.side===2?'neutral':e.guard?'guard':e.side===1?'march':'think';e.path=[];
    if(o.held){e.held=true;G.held.push(e);}G.ents.push(e);}
  recount();G.fogDirty=true;
  document.getElementById('log').innerHTML='';
  msg('Saved game loaded.');
  syncCpu();
}
// Games are saved in this browser (localStorage).
function lsGet(){try{const s=localStorage.getItem('underlord-save');return s?JSON.parse(s):null;}catch(e){return null;}}
function lsSet(d){try{localStorage.setItem('underlord-save',JSON.stringify(d));return true;}catch(e){return false;}}
async function readSave(){return lsGet();}
let saving=false;
async function saveGame(auto){
  if(!G||G.over||saving)return;saving=true;
  const d=serialize(),ok=lsSet(d);
  saving=false;
  const el=document.getElementById('savedAt');
  if(ok){el.textContent=(auto?'Autosaved ':'Saved ')+new Date(d.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});el.title='Stored in this browser';if(!auto)msg('Game saved.','save'+G.time,'good');}
  else{el.textContent='Saving failed';if(!auto)msg('The game could not be saved here.','savefail','bad');}
  refreshContinue();
}
async function loadGame(){
  const s=await readSave();
  if(!s){msg('No saved game found.','nosave','bad');return;}
  if(s.v!==SAVE_V){msg('That save is from an older version of the game and cannot be loaded.','oldsave','bad');return;}
  deserialize(s);document.getElementById('ov').hidden=true;running=true;paused=false;syncPause();
}
async function refreshContinue(){const s=await readSave();const b=document.getElementById('bContinue');if(b)b.hidden=!s;document.getElementById('bLoad').disabled=!s;}

/* ---------- drawing ---------- */
function rr(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function circ(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function solidForShade(i){const t=G.t[i];return t===ROCK||t===EARTH||t===GOLD||t===GEM||t===WALL;}
function drawEarthBase(px,py,s,x,y){
  rr(px,py,s,s,'#2e2017');
  const h=hash(x,y);rr(px+1,py+1,s-2,s-2,['#4b3423','#4f3725','#46301f'][h*3|0]);
  rr(px+1,py+1,s-2,s*.16,'rgba(255,220,180,.06)');
  for(let k=0;k<3;k++)rr(px+hash(x,y,k+1)*(s-3)+1,py+hash(x,y,k+9)*(s-3)+1,s*.12,s*.1,'rgba(0,0,0,.28)');
}
const TILE_SPR={[EARTH]:'tiles.earth',[GOLD]:'tiles.gold',[GEM]:'tiles.gem',[ROCK]:'tiles.rock',[FLOOR]:'tiles.floor',[GATE]:'tiles.floor',[PORTAL]:'tiles.floor',[CLAIM]:'tiles.claimed',[HEART]:'tiles.claimed',[WALL]:'tiles.wall'};
const MIRROR=new Set([EARTH,ROCK,FLOOR,GOLD,GEM]);
// Tiles snap to whole pixels and overlap by one, so no seams show between them.
function tileSpr(k,px,py,s,flip){const x0=Math.floor(px),y0=Math.floor(py);return spr(k,x0,y0,Math.ceil(px+s)-x0+.5,Math.ceil(py+s)-y0+.5,flip);}
function drawTile(x,y,now){
  const i=ix(x,y);if(!G.seen[i])return;
  const t=G.t[i],s=TS,px=x*s,py=y*s;
  const ta=TILE_SPR[t];
  if(!(ta&&tileSpr(ta,px,py,s,MIRROR.has(t)&&hash(x,y,77)<.5)))switch(t){
    case ROCK:{rr(px,py,s,s,'#0f0e12');rr(px+1,py+1,s-2,s-2,['#1b1a21','#1e1d24','#18171d'][hash(x,y)*3|0]);
      for(let k=0;k<2;k++)rr(px+hash(x,y,k+3)*(s-4)+1,py+hash(x,y,k+5)*(s-4)+1,s*.18,s*.08,'rgba(255,255,255,.05)');break;}
    case EARTH:drawEarthBase(px,py,s,x,y);break;
    case WALL:{rr(px,py,s,s,'#1a1513');const bh=s/3;
      for(let r=0;r<3;r++){const off=(r%2)*s/4;for(let c=-1;c<3;c++){const bx=px+off+c*s/2,x0=Math.max(px+1,bx+1),x1=Math.min(px+s-1,bx+s/2-1);if(x1>x0)rr(x0,py+r*bh+1,x1-x0,bh-2,hash(x*4+c,y*3+r)<.5?'#4a3f3a':'#433833');}}
      rr(px+1,py+1,s-2,s*.08,'rgba(255,230,210,.10)');
      if(G.hp[i]<WALL_HP)rr(px+s*.3,py+s*.3,s*.4,s*.06,'rgba(0,0,0,.5)');break;}
    case GOLD:{drawEarthBase(px,py,s,x,y);for(let k=0;k<3;k++){const gx=px+s*(.2+hash(x,y,k+11)*.6),gy=py+s*(.2+hash(x,y,k+21)*.6);circ(gx,gy,s*.11,'#c8941f');circ(gx-s*.03,gy-s*.03,s*.05,'#ffe18a');}
      if(Math.sin(now*2.5+hash(x,y)*40)>.96)circ(px+s*.5,py+s*.4,s*.06,'#fff6d0');break;}
    case GEM:{drawEarthBase(px,py,s,x,y);const c=['#56d6ea','#c27cf5'];for(let k=0;k<2;k++){const gx=px+s*(.3+k*.35),gy=py+s*(.35+hash(x,y,k)*.3),r=s*.14;ctx.fillStyle=c[k];ctx.beginPath();ctx.moveTo(gx,gy-r);ctx.lineTo(gx+r*.7,gy);ctx.lineTo(gx,gy+r);ctx.lineTo(gx-r*.7,gy);ctx.fill();}
      circ(px+s*.5,py+s*.5,s*.4*(.5+.5*Math.sin(now*2+x)),'rgba(150,220,255,.07)');break;}
    case LAVA:{rr(px,py,s,s,'#6e1906');for(let k=0;k<3;k++){const a=now*.8+hash(x,y,k)*6;circ(px+s*(.25+.5*hash(x,y,k+2)),py+s*(.25+.5*hash(x,y,k+4)),s*(.14+.06*Math.sin(a)),k?'#e0561b':'#ffae3a');}break;}
    case FLOOR:case GATE:case PORTAL:{rr(px,py,s,s,'#1d1713');rr(px+1,py+1,s-2,s-2,'#241c17');
      for(let k=0;k<2;k++)circ(px+s*(.2+.6*hash(x,y,k+7)),py+s*(.2+.6*hash(x,y,k+8)),s*.05,'rgba(140,110,85,.25)');break;}
    case CLAIM:{rr(px,py,s,s,'#1a0e0c');const h2=s/2;
      for(let a=0;a<2;a++)for(let b=0;b<2;b++)rr(px+a*h2+1,py+b*h2+1,h2-1.5,h2-1.5,hash(x*2+a,y*2+b)<.5?'#3a201b':'#341c18');
      const c=s*.09;ctx.fillStyle='rgba(200,45,35,.55)';ctx.beginPath();ctx.moveTo(px+s/2,py+s/2-c);ctx.lineTo(px+s/2+c,py+s/2);ctx.lineTo(px+s/2,py+s/2+c);ctx.lineTo(px+s/2-c,py+s/2);ctx.fill();break;}
    case HEART:rr(px,py,s,s,'#1a0e0c');break;
  }
  if(t===FLOOR||t===CLAIM||t===GATE||t===PORTAL){
    if(y>0&&solidForShade(i-W)){rr(px,py,s,s*.28,'rgba(0,0,0,.35)');rr(px,py,s,s*.12,'rgba(0,0,0,.3)');}
    if(x>0&&solidForShade(i-1))rr(px,py,s*.14,s,'rgba(0,0,0,.25)');
  }else if(t===EARTH||t===GOLD||t===GEM||t===WALL){
    if(y<H-1&&walk(i+W))rr(px,py+s*.8,s,s*.2,'rgba(0,0,0,.4)');
  }
  if(G.loot[i]>0&&!spr('props.chest',px+s*.1,py+s*.1,s*.8,s*.8)){const cx=px+s/2,cy=py+s*.58;rr(cx-s*.24,cy-s*.12,s*.48,s*.28,'#6b3f1c');rr(cx-s*.24,cy-s*.2,s*.48,s*.1,'#8a5426');rr(cx-s*.04,cy-s*.12,s*.08,s*.1,'#e3b23c');
    if(Math.sin(now*3+i)>.9)circ(cx+s*.15,cy-s*.22,s*.05,'#fff6d0');}
  if(G.mark[i]&&diggable(i))drawMark(px,py,s);
  const r=G.room[i];if(r)drawRoom(i,r,px,py,s,now,x,y);
}
function drawMark(px,py,s){
  rr(px,py,s,s,'rgba(227,178,60,.2)');ctx.strokeStyle='rgba(227,178,60,.85)';ctx.lineWidth=1.5;ctx.strokeRect(px+2,py+2,s-4,s-4);
  ctx.beginPath();ctx.moveTo(px+s*.3,py+s*.7);ctx.lineTo(px+s*.7,py+s*.3);ctx.moveTo(px+s*.55,py+s*.22);ctx.lineTo(px+s*.78,py+s*.45);ctx.stroke();
}
function drawShroudTile(x,y,now){
  const i=ix(x,y),t=G.t[i],s=TS,px=x*s,py=y*s;
  if(t===GOLD){ctx.globalAlpha=.7;for(let k=0;k<3;k++){const gx=px+s*(.2+hash(x,y,k+11)*.6),gy=py+s*(.2+hash(x,y,k+21)*.6);circ(gx,gy,s*.11,'#b8851c');circ(gx-s*.03,gy-s*.03,s*.05,'#f2d27a');}
    ctx.globalAlpha=1;if(Math.sin(now*2.5+hash(x,y)*40)>.97)circ(px+s*.5,py+s*.4,s*.06,'#fff6d0');}
  else if(t===GEM){ctx.globalAlpha=.7;const c=['#56d6ea','#c27cf5'];for(let k=0;k<2;k++){const gx=px+s*(.3+k*.35),gy=py+s*(.35+hash(x,y,k)*.3),r=s*.14;ctx.fillStyle=c[k];ctx.beginPath();ctx.moveTo(gx,gy-r);ctx.lineTo(gx+r*.7,gy);ctx.lineTo(gx,gy+r);ctx.lineTo(gx-r*.7,gy);ctx.fill();}ctx.globalAlpha=1;}
  if(G.mark[i]&&diggable(i))drawMark(px,py,s);
}
function drawChicken(x,y,now){
  const s=TS,px=x*s,py=y*s,ph=now*(.6+hash(x,y,40))+hash(x,y,41)*9,chx=px+s*(.5+.28*Math.sin(ph)),chy=py+s*(.5+.22*Math.cos(ph*1.3));
  if(!spr('props.hatchery-chicken',chx-s*.22,chy-s*.24,s*.44,s*.44,Math.cos(ph)<0)){circ(chx,chy,s*.09,'#f2ece0');circ(chx+s*.06,chy-s*.04,s*.03,'#d23b2b');}
}
function drawRoom(i,r,px,py,s,now,x,y){
  const R=ROOMS[r];
  if(r===TREAS){rr(px,py,s,s,'rgba(227,178,60,.10)');const f=Math.max(0,Math.min(1,(G.money-HEART_CAP)/(TREAS_CAP*G.rc[TREAS])));
    if(f>0&&!spr('props.treasury-pile',px+s*(.5-(.2+.28*f)),py+s*(.92-(.4+.56*f)),s*(.4+.56*f),s*(.4+.56*f))){const rad=s*(.12+.24*f);circ(px+s/2,py+s*.6,rad,'#b8851c');circ(px+s/2,py+s*.6-rad*.25,rad*.75,'#e3b23c');circ(px+s/2-rad*.3,py+s*.6-rad*.45,rad*.22,'#fff0b0');}}
  else if(r===LAIR){rr(px,py,s,s,'rgba(110,80,170,.14)');if(beds.has(i)&&!spr('props.lair-nest',px+s*.04,py+s*.04,s*.92,s*.92)){ctx.fillStyle='#3a2c22';ctx.beginPath();ctx.ellipse(px+s/2,py+s*.55,s*.34,s*.24,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#140e0b';ctx.beginPath();ctx.ellipse(px+s/2,py+s*.55,s*.22,s*.13,0,0,Math.PI*2);ctx.fill();}
    // the owner's colour marks whose bed it is
    if(beds.has(i)){circ(px+s*.82,py+s*.18,s*.11,'#2b1b12');circ(px+s*.82,py+s*.18,s*.08,KINDS[beds.get(i)].col);}}
  else if(r===HATCH){rr(px,py,s,s,'rgba(180,150,50,.13)');ctx.strokeStyle='rgba(216,176,74,.35)';ctx.lineWidth=1;ctx.beginPath();
    for(let k=0;k<4;k++){const a=hash(x,y,k+30)*Math.PI;const cx=px+s*(.2+.6*hash(x,y,k+31)),cy=py+s*(.2+.6*hash(x,y,k+32));ctx.moveTo(cx-Math.cos(a)*s*.12,cy-Math.sin(a)*s*.12);ctx.lineTo(cx+Math.cos(a)*s*.12,cy+Math.sin(a)*s*.12);}ctx.stroke();
  }
  else if(r===TRAIN){rr(px,py,s,s,'rgba(190,60,40,.12)');if((x+y)%2===0&&!spr('props.training-dummy',px+s*.06,py+s*.02,s*.88,s*.88)){rr(px+s*.45,py+s*.2,s*.1,s*.62,'#6b4a2e');rr(px+s*.25,py+s*.35,s*.5,s*.08,'#6b4a2e');circ(px+s*.5,py+s*.2,s*.09,'#8a6a46');}}
  else if(r===LIB){rr(px,py,s,s,'rgba(70,110,180,.14)');if(!spr('props.library-shelf',px+s*.04,py+s*.04,s*.92,s*.92)){rr(px+s*.15,py+s*.18,s*.7,s*.5,'#2a1c14');const bc=['#7a2b2b','#2d5a7a','#6b5a2a','#3d6b3a','#5a3a7a'];
    for(let k=0;k<5;k++)rr(px+s*(.18+k*.13),py+s*(.22+hash(x,y,k)*.06),s*.1,s*.42,bc[(k+x+y)%5]);}}
  ctx.strokeStyle=R.col;ctx.globalAlpha=.55;ctx.lineWidth=1.5;ctx.beginPath();
  if(y>0&&G.room[i-W]!==r){ctx.moveTo(px,py+.75);ctx.lineTo(px+s,py+.75);}
  if(y<H-1&&G.room[i+W]!==r){ctx.moveTo(px,py+s-.75);ctx.lineTo(px+s,py+s-.75);}
  if(x>0&&G.room[i-1]!==r){ctx.moveTo(px+.75,py);ctx.lineTo(px+.75,py+s);}
  if(x<W-1&&G.room[i+1]!==r){ctx.moveTo(px+s-.75,py);ctx.lineTo(px+s-.75,py+s);}
  ctx.stroke();ctx.globalAlpha=1;
}
function drawSpecials(now){
  const s=TS,cx=(G.hx+.5)*s,cy=(G.hy+.5)*s;
  const heartSpr=spr('props.heart',cx-s*1.5,cy-s*1.5,s*3,s*3);
  if(!heartSpr)for(let k=0;k<8;k++){const a=k*Math.PI/4+.39,r1=s*1.25,r2=s*1.6;ctx.fillStyle='#2a1512';ctx.beginPath();ctx.moveTo(cx+Math.cos(a-.18)*r1,cy+Math.sin(a-.18)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.lineTo(cx+Math.cos(a+.18)*r1,cy+Math.sin(a+.18)*r1);ctx.fill();}
  if(!heartSpr){circ(cx,cy,s*1.35,'#160b0a');ctx.strokeStyle='#4a1d18';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,s*1.3,0,Math.PI*2);ctx.stroke();}
  const beat=Math.pow(Math.max(0,Math.sin(now*2.6)),8),r=s*(.62+.08*beat),hp=G.heartHP/G.heartMax;
  const gl=ctx.createRadialGradient(cx,cy,0,cx,cy,s*1.3);gl.addColorStop(0,'rgba(255,70,50,'+(.25+.25*beat)+')');gl.addColorStop(1,'rgba(255,70,50,0)');ctx.fillStyle=gl;ctx.beginPath();ctx.arc(cx,cy,s*1.3,0,Math.PI*2);ctx.fill();
  const g=ctx.createRadialGradient(cx-r*.3,cy-r*.3,r*.1,cx,cy,r);g.addColorStop(0,'#ff9a7a');g.addColorStop(.45,hp>.3?'#d42a1f':'#8a1a14');g.addColorStop(1,'#3a0606');
  if(!heartSpr){ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();}
  else if(beat>.05)circ(cx,cy,r*1.05,'rgba(255,120,90,'+(beat*.35)+')');
  if(G.heartFlash>0)circ(cx,cy,r,'rgba(255,255,255,'+(G.heartFlash*2)+')');
  for(const P of G.portals){const own=!!G.pown[P],px=(tx(P)+.5)*s,py=(ty(P)+.5)*s;
    const gp=ctx.createRadialGradient(px,py,0,px,py,s*1.4);gp.addColorStop(0,own?'rgba(220,90,220,.35)':'rgba(150,110,200,.22)');gp.addColorStop(1,'rgba(150,110,200,0)');ctx.fillStyle=gp;ctx.beginPath();ctx.arc(px,py,s*1.4,0,Math.PI*2);ctx.fill();
    const pk=own?'props.portal':'props.portal-unclaimed',ps=sprite(pk,s*.96*DPR,s*.96*DPR);
    if(ps){ctx.save();ctx.translate(px,py);ctx.rotate(now*(own?1.4:.4));ctx.drawImage(ps,-s*.48,-s*.48,s*.96,s*.96);ctx.restore();continue;}
    circ(px,py,s*.46,'#0e0818');ctx.lineWidth=s*.08;ctx.lineCap='round';
    for(let k=0;k<3;k++){ctx.strokeStyle=own?(k?'#c24bd6':'#ff6ad5'):(k?'#4a3a5e':'#6d5a86');ctx.beginPath();const a=now*(own?2.2:.7)+k*2.09;ctx.arc(px,py,s*(.18+k*.08),a,a+1.6);ctx.stroke();}ctx.lineCap='butt';}
  if(G.seen[G.gate]){const gx=(tx(G.gate)+.5)*s,gy=(ty(G.gate)+.5)*s;const gl2=ctx.createRadialGradient(gx,gy,0,gx,gy,s*1.2);gl2.addColorStop(0,'rgba(190,215,255,'+(.35+.1*Math.sin(now*2))+')');gl2.addColorStop(1,'rgba(190,215,255,0)');
    ctx.fillStyle=gl2;ctx.beginPath();ctx.arc(gx,gy,s*1.2,0,Math.PI*2);ctx.fill();
    if(spr('props.gate',gx-s*.5,gy-s*.5,s,s))return;
    ctx.fillStyle='#24344a';ctx.beginPath();ctx.moveTo(gx-s*.36,gy+s*.4);ctx.lineTo(gx-s*.36,gy-s*.05);ctx.arc(gx,gy-s*.05,s*.36,Math.PI,0);ctx.lineTo(gx+s*.36,gy+s*.4);ctx.fill();
    ctx.fillStyle='#d8e6ff';ctx.beginPath();ctx.moveTo(gx-s*.2,gy+s*.4);ctx.lineTo(gx-s*.2,gy);ctx.arc(gx,gy,s*.2,Math.PI,0);ctx.lineTo(gx+s*.2,gy+s*.4);ctx.fill();}
}
function drawEnt(e,now,ex,ey,alpha=1){
  const s=TS,k=KINDS[e.kind],x=ex*s,y=ey*s;ctx.globalAlpha=alpha;
  const bob=(e.state==='walk'||e.state==='march'||e.state==='leave')?Math.sin(now*12+e.id)*s*.03:0;
  const r=s*(e.kind==='imp'?.24:k.big?.44:.32);
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x,y+r*.85,r*.9,r*.3,0,0,Math.PI*2);ctx.fill();
  const yy=y+bob;
  const sz=r*2.9,us=sprite('units.'+e.kind,sz*DPR,sz*DPR);
  if(us){
    ctx.strokeStyle=e.side===1?'rgba(188,210,240,.8)':e.side===2?'rgba(150,140,130,.6)':'rgba(224,72,60,.75)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y+r*.85,r*.95,r*.32,0,0,Math.PI*2);ctx.stroke();
    if(e.side===2)ctx.globalAlpha=alpha*.65;
    if(e.slap>0&&Math.sin(now*30)>0)ctx.globalAlpha=alpha*.55;
    const top=yy+r*.95-sz;
    if(e.face<0){ctx.save();ctx.translate(x,0);ctx.scale(-1,1);ctx.drawImage(us,-sz/2,top,sz,sz);ctx.restore();}else ctx.drawImage(us,x-sz/2,top,sz,sz);
    ctx.globalAlpha=alpha;
    if(e.side===2){ctx.fillStyle='#d8d0c4';ctx.font='700 '+Math.round(r)+'px "Gill Sans","Segoe UI","Trebuchet MS",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',x,top+sz*.1);}
  }else{
  if(e.kind==='imp'){ctx.fillStyle='#e9a04a';for(const sx of[-1,1]){ctx.beginPath();ctx.moveTo(x+sx*r*.5,yy-r*.6);ctx.lineTo(x+sx*r*.95,yy-r*1.25);ctx.lineTo(x+sx*r*.15,yy-r*.8);ctx.fill();}}
  circ(x,yy,r+(e.side===1?2:1.2),e.side===1?'#e6eef9':e.side===2?'#7d756c':'#0b0706');
  circ(x,yy,r,e.slap>0&&Math.sin(now*30)>0?'#ffd2a8':e.side===2?'#5a554f':k.col);
  circ(x-r*.3,yy-r*.35,r*.35,'rgba(255,255,255,.18)');
  if(e.kind==='imp'){circ(x+e.face*r*.35,yy-r*.1,r*.14,'#ffe9a0');}
  else{ctx.fillStyle=e.side===1?'#0e1520':e.side===2?'#d8d0c4':'#120c0a';ctx.font='700 '+Math.round(r*1.15)+'px "Gill Sans","Segoe UI","Trebuchet MS",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(e.side===2?'?':k.g,x,yy+r*.06);}
  if(e.side===1&&e.kind!=='tunneller'&&e.kind!=='archer'){ctx.fillStyle='#e6eef9';ctx.fillRect(x-r*.12,yy-r*1.45,r*.24,r*.4);}
  }
  if(e.carry>0)circ(x+r*.75,yy+r*.4,s*.08+s*.04*Math.min(1,e.carry/100),'#e3b23c');
  if(e.hp<e.maxhp){const w=s*.7,hy_=us?yy+r*.95-sz-s*.08:yy-r-s*.2;rr(x-w/2,hy_,w,s*.07,'rgba(0,0,0,.7)');rr(x-w/2,hy_,w*Math.max(0,e.hp/e.maxhp),s*.07,e.side===1?'#8fb4ef':'#5fcf6a');}
  if(e.lvl>1){ctx.fillStyle='#e3b23c';ctx.font='700 '+Math.round(s*.3)+'px "Gill Sans","Segoe UI","Trebuchet MS",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(e.lvl,x+r*.95,yy-r*.8);}
  if(e.state==='sleep'||e.state==='guard'){ctx.fillStyle=e.state==='guard'?'#bcd2f0':'#cdbbf5';ctx.font='700 '+Math.round(s*.32)+'px "Gill Sans","Segoe UI","Trebuchet MS",sans-serif';ctx.fillText('z',x+r*.9,yy-r*1.1-((now*.8+e.id)%1)*s*.3);}
  ctx.globalAlpha=1;
}
function makeCloud(){
  cloud.width=layer.width=cv.width;cloud.height=layer.height=cv.height;
  const w=cloud.width,h=cloud.height,s=BASE*1.6*DPR;
  cctx.fillStyle='#0c0a0f';cctx.fillRect(0,0,w,h);
  const n=Math.round(w*h/(s*s)*1.4);
  for(let k=0;k<n;k++){
    const x=Math.random()*w,y=Math.random()*h,r=s*(.8+Math.random()*1.8);
    const light=Math.random();const col=light<.6?'40,34,52':light<.9?'62,54,78':'92,82,110';
    const a=light<.6?.45:light<.9?.25:.12;
    for(const ox of[-w,0,w])for(const oy of[-h,0,h]){const cx=x+ox,cy=y+oy;if(cx<-r||cy<-r||cx>w+r||cy>h+r)continue;const g=cctx.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba('+col+','+a+')');g.addColorStop(1,'rgba('+col+',0)');cctx.fillStyle=g;cctx.fillRect(cx-r,cy-r,r*2,r*2);}
  }
}
function drawFog(now,sig,x0,x1,y0,y1){
  if(G.fogDirty)rebuildFog();
  const w=layer.width,h=layer.height,key=sig+'|'+cam.x+'|'+cam.y+'|'+TS+'|'+w+'|'+Object.keys(IMG).length;
  if(key!==fogKey||now-fogT>.1){fogKey=key;fogT=now;
  lctx.globalCompositeOperation='source-over';lctx.clearRect(0,0,w,h);
  lctx.imageSmoothingEnabled=true;lctx.drawImage(fogC,0,0,W,H,cam.x*DPR,cam.y*DPR,W*TS*DPR,H*TS*DPR);
  lctx.globalCompositeOperation='source-in';
  const md=(a,m)=>((a%m)+m)%m,ox=md(cam.x*DPR+now*BASE*DPR*.15,w),oy=md(cam.y*DPR,h);
  for(const a of[ox-w,ox])for(const b of[oy-h,oy])lctx.drawImage(cloud,a,b);
  // gold, gems and dig marks show through the clouds
  lctx.globalCompositeOperation='source-over';ctx=lctx;setWorld();
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!G.seen[ix(x,y)])drawShroudTile(x,y,now);
  ctx=mainCtx;lctx.setTransform(1,0,0,1,0,0);}
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(layer,0,0);setWorld();
}
function dragRect(){if(!drag)return null;return{x0:Math.min(drag.x0,drag.x1),y0:Math.min(drag.y0,drag.y1),x1:Math.max(drag.x0,drag.x1),y1:Math.max(drag.y0,drag.y1)};}
function setWorld(){ctx.setTransform(DPR,0,0,DPR,cam.x*DPR,cam.y*DPR);}
function clampCam(){
  const mw=W*TS,mh=H*TS;
  cam.x=mw<=SW?(SW-mw)/2:Math.min(0,Math.max(SW-mw,cam.x));
  cam.y=mh<=SH?(SH-mh)/2:Math.min(0,Math.max(SH-mh,cam.y));
}
function zoomAt(nz,sx,sy){nz=Math.max(1,Math.min(4,nz));const wx=(sx-cam.x)/TS,wy=(sy-cam.y)/TS;Z=nz;TS=BASE*Z;cam.x=sx-wx*TS;cam.y=sy-wy*TS;clampCam();}
function centerOn(x,y){cam.x=SW/2-(x+.5)*TS;cam.y=SH/2-(y+.5)*TS;clampCam();}
let beds=new Map(); // Lair tile -> kind of the creature that claimed it as its bed: only those tiles show a nest.
function draw(){
  const now=performance.now()/1000,s=TS;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  rr(0,0,SW,SH,'#050404');
  setWorld();
  rr(0,0,W*s,H*s,'#070505');
  const x0=Math.max(0,Math.floor(-cam.x/s)),x1=Math.min(W-1,Math.floor((SW-cam.x)/s)),y0=Math.max(0,Math.floor(-cam.y/s)),y1=Math.min(H-1,Math.floor((SH-cam.y)/s));
  // Terrain is cached in `terr` and only redrawn when a visible tile, the view, the treasury fill or a bed changes.
  beds=new Map(G.ents.filter(e=>!e.dead&&hasBed(e)).map(e=>[e.bed,e.kind]));
  let sig=0;
  for(let y=Math.max(0,y0-1);y<=Math.min(H-1,y1+1);y++)for(let x=Math.max(0,x0-1);x<=Math.min(W-1,x1+1);x++){const i=ix(x,y);
    sig=(Math.imul(sig,31)+(G.t[i]|G.room[i]<<4|G.mark[i]<<7|G.seen[i]<<8|(G.loot[i]>0)<<9|(G.t[i]===WALL&&G.hp[i]<WALL_HP)<<10))|0;}
  const tf=G.rc[TREAS]?Math.round(10*Math.max(0,Math.min(1,(G.money-HEART_CAP)/(TREAS_CAP*G.rc[TREAS])))):0;
  const key=sig+'|'+cam.x+'|'+cam.y+'|'+TS+'|'+cv.width+'|'+tf+'|'+Object.keys(IMG).length+'|'+[...beds].map(([i,k])=>i+k).sort().join(',');
  if(key!==terrKey){terrKey=key;if(terr.width!==cv.width||terr.height!==cv.height){terr.width=cv.width;terr.height=cv.height;}
    const tc=terr.getContext('2d');tc.setTransform(1,0,0,1,0,0);tc.clearRect(0,0,terr.width,terr.height);
    ctx=tc;setWorld();for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const t=G.t[ix(x,y)];if(t!==LAVA)drawTile(x,y,0);}ctx=mainCtx;}
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(terr,0,0);setWorld();
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=ix(x,y);if(!G.seen[i])continue;if(G.t[i]===LAVA)drawTile(x,y,now);else if(G.room[i]===HATCH)drawChicken(x,y,now);}
  drawSpecials(now);
  const es=G.ents.filter(e=>!e.held&&(e.side===0||G.seen[ti(e)])).sort((a,b)=>a.y-b.y);
  for(const e of es)drawEnt(e,now,e.x,e.y);
  for(const f of G.fx){const p=f.t/f.dur;
    if(f.type==='proj'){const x=(f.x+(f.x1-f.x)*p)*s,y=(f.y+(f.y1-f.y)*p)*s;circ(x,y,s*.14,f.col+'55');circ(x,y,s*.07,f.col);}
    else if(f.type==='dust'){ctx.globalAlpha=1-p;for(let k=0;k<4;k++){const a=k*1.7+f.x*3;circ((f.x+Math.cos(a)*p*.35)*s,(f.y+Math.sin(a)*p*.35)*s,s*.06,f.col);}ctx.globalAlpha=1;}
    else if(f.type==='ring'){ctx.strokeStyle=f.col;ctx.globalAlpha=1-p;ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x*s,f.y*s,s*(.2+p*.7),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    else if(f.type==='text'){ctx.globalAlpha=1-p*p;ctx.fillStyle=f.col;ctx.font='700 '+Math.round(s*.42)+'px "Gill Sans","Segoe UI","Trebuchet MS",sans-serif';ctx.textAlign='center';ctx.fillText(f.txt,f.x*s,(f.y-p*.8)*s);ctx.globalAlpha=1;}
    else if(f.type==='bolt'){ctx.globalAlpha=1-p;ctx.strokeStyle='#dfe9ff';ctx.lineWidth=3;ctx.beginPath();let bx=f.x*s,by=0;ctx.moveTo(bx,by);
      for(let k=1;k<=8;k++){by=f.y*s*k/8;bx=f.x*s+(k<8?(hash(k,f.seed)-.5)*s*1.4:0);ctx.lineTo(bx,by);}ctx.stroke();circ(f.x*s,f.y*s,s*1.6*(1-p),'rgba(200,220,255,.25)');ctx.globalAlpha=1;}
    else if(f.type==='heal'){ctx.strokeStyle='#7fe08a';ctx.globalAlpha=1-p;ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x*s,f.y*s,s*2.5*p,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  }
  drawFog(now,sig,x0,x1,y0,y1);
  // Dungeon Keeper style: invading heroes show as white dots in unexplored ground; you only see
  // which hero it is once it enters ground you have discovered.
  for(const e of unknownHeroes()){const x=e.x*s,y=e.y*s,p=.5+.5*Math.sin(now*5+e.id);
    circ(x,y,s*(.22+.08*p),'rgba(255,255,255,'+(.18+.12*p)+')');circ(x,y,s*.11,'#ffffff');}
  if(G.rally&&G.time<G.rally.until){const x=(tx(G.rally.i)+.5)*s,y=(ty(G.rally.i)+.5)*s;rr(x-1,y-s*.7,2,s*.7,'#c9b28a');ctx.fillStyle='#b3261e';ctx.beginPath();ctx.moveTo(x+1,y-s*.7);ctx.lineTo(x+s*.45,y-s*.55);ctx.lineTo(x+1,y-s*.4);ctx.fill();}
  const R=dragRect();
  if(R){
    const col=drag.mode==='unmark'||drag.mode==='sell'?'224,72,60':drag.mode==='mark'?'227,178,60':'190,220,160';
    for(let y=R.y0;y<=R.y1;y++)for(let x=R.x0;x<=R.x1;x++)if(affects(drag.mode,ix(x,y)))rr(x*s,y*s,s,s,'rgba('+col+',.28)');
    ctx.strokeStyle='rgba('+col+',.95)';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(R.x0*s+1,R.y0*s+1,(R.x1-R.x0+1)*s-2,(R.y1-R.y0+1)*s-2);ctx.setLineDash([]);
  }else if(hover.in&&inb(hover.x,hover.y)){
    const ok=toolValid(ix(hover.x,hover.y));ctx.strokeStyle=ok?'rgba(240,220,180,.9)':'rgba(224,72,60,.8)';ctx.lineWidth=2;ctx.strokeRect(hover.x*s+1,hover.y*s+1,s-2,s-2);
  }
  if(hover.in&&G.held.length){for(let k=Math.min(G.held.length,4)-1;k>=0;k--)drawEnt(G.held[G.held.length-1-k],now,hover.fx+.25+k*.15,hover.fy-.35-k*.12,.9);}
}

/* ---------- input ---------- */
function affects(mode,i){
  if(mode==='mark')return G.seen[i]?diggable(i)&&!G.mark[i]:!G.mark[i]&&G.t[i]!==ROCK;
  if(mode==='unmark')return !!G.mark[i];
  if(!G.seen[i])return false;
  if(mode==='unmark')return !!G.mark[i];
  if(mode==='sell')return !!G.room[i];
  if(ROOMS[mode])return G.t[i]===CLAIM&&!G.room[i];
  return false;
}
function toolValid(i){
  if(tool==='hand'){if(G.held.length)return G.t[i]===CLAIM||ownPortal(i);return !G.seen[i]||diggable(i)||!!entAt(hover.fx,hover.fy);}
  if(tool==='slap')return !!entAt(hover.fx,hover.fy);
  if(ROOMS[tool])return affects(tool,i);
  if(tool==='sell')return !!G.room[i];
  if(tool==='imp')return G.t[i]===CLAIM;
  if(tool==='rally')return G.seen[i]&&walk(i);
  return G.seen[i];
}
// Dropping a creature (Dungeon Keeper 2 style): it lands dazed, and if it lands in a room it starts working there with a bonus.
function dropHeld(i){
  const d=G.held.pop();d.held=false;d.x=tx(i)+.5;d.y=ty(i)+.5;d.path=[];d.scan=0;d.target=null;
  const r=G.room[i],k=d.kind!=='imp';
  // Dropped on a free Lair tile, a creature moves its bed there; another creature's bed stays locked.
  const bed=k&&r===LAIR&&!bedOwner(i,d);if(bed)d.bed=i;
  d.after=k&&r===TRAIN&&G.money>0?['train',8]:k&&r===LIB?['study',8]:bed?['sleep',0]:k&&r===HATCH?['eat',2.5]:null;
  d.boost=d.after?CFG.hand.workBoost:1;d.state='stun';d.timer=CFG.hand.dropStun;
  fx({type:'ring',x:d.x,y:d.y,dur:.4,col:'#eadcc6'});fx({type:'dust',x:d.x,y:d.y+.3,dur:.4,col:'#8a6446'});
}
function pickUp(e){
  if(G.held.length>=CFG.hand.capacity){msg('Your hand is full ('+CFG.hand.capacity+'). Drop a creature first.','handfull','bad');return false;}
  release(e);e.held=true;e.path=[];e.target=null;e.boost=1;G.held.push(e);return true;
}
function activity(e){
  if(e.held)return 'hand';const st=e.state==='walk'?e.next:e.state;
  if(st==='fight')return 'fighting';
  return['dig','claim','reinforce','deposit','train','study','eat','sleep'].includes(st)?'working':'idle';
}
/* ---------- computer assistant ---------- */
// Modelled on Dungeon Keeper 1's Computer Assistant: Aggressive, Defensive, Construction only, Move only.
const CPU_DOES={aggressive:{build:1,move:1,attack:1},defensive:{build:1,move:1,guard:1},construction:{build:1},move:{move:1}};
function cpuTick(dt){
  const c=G.cpu;if(!c||!c.on)return;if((c.t-=dt)>0)return;c.t=CFG.assistant.interval;
  const d=CPU_DOES[c.mode]||{};
  if(d.build)cpuBuild();
  if(d.move)cpuMove();
  if(d.attack||d.guard)cpuSpells(!!d.attack);
}
const marksCount=()=>{let n=0;for(let i=0;i<N;i++)n+=G.mark[i];return n;};
function cpuMark(list){let n=marksCount();for(const i of list){if(n>=CFG.assistant.maxMarks)break;if(diggable(i)&&G.t[i]!==WALL&&!G.mark[i]){G.mark[i]=1;n++;}}}
function cpuBuild(){
  const A=CFG.assistant;
  // 1. tunnel to the nearest portal until one is ours
  if(!anyPortal()){for(const P of G.portals.slice().sort((a,b)=>Math.hypot(tx(a)-G.hx,ty(a)-G.hy)-Math.hypot(tx(b)-G.hx,ty(b)-G.hy))){
    const p=bfs(P,i=>G.t[i]===CLAIM,1,i=>walk(i)||diggable(i)&&G.t[i]!==GEM);if(p){cpuMark(p);break;}}}
  // 2. tunnel to the nearest gold seam (gold glints through the clouds, so the player knows where it is)
  if(G.money<cap()*.9&&marksCount()<CFG.assistant.maxMarks/2){
    const p=bfs(ix(G.hx+2,G.hy),i=>(G.t[i]===GOLD||G.t[i]===GEM&&G.money<cap()*.5)&&!G.mark[i],1,i=>walk(i)||diggable(i)&&G.t[i]!==WALL);
    if(p)cpuMark(p);}
  // 3. rooms, in the order a keeper needs them
  const cre=creatures().length+G.held.filter(e=>e.kind!=='imp').length;
  const want=[[LAIR,Math.max(4,cre+2)],[HATCH,4],[TREAS,G.money>cap()*.75?G.rc[TREAS]+4:Math.max(G.rc[TREAS],2)],[TRAIN,cre>=3?9:0],[LIB,cre>=3?9:0],[HATCH,cre>=5?9:4],[LAIR,cre>=5?Math.max(9,cre+2):0]];
  let short=false;
  for(const[r,n]of want){
    if(G.rc[r]>=n)continue;const cost=ROOMS[r].cost;
    let need=n-G.rc[r];if(G.money-A.reserveGold<cost*need)need=Math.floor((G.money-A.reserveGold)/cost);if(need<=0)break;
    const seeds=[];for(let i=0;i<N;i++)if(G.room[i]===r)seeds.push(i);
    const free=[];const seen=new Uint8Array(N),q=seeds.length?seeds:[ix(G.hx+2,G.hy)];for(const i of q)seen[i]=1;
    for(let h=0;h<q.length&&free.length<need;h++){const c=q[h];if(G.t[c]===CLAIM&&!G.room[c]&&!adjHeart(c))free.push(c);
      for(const[dx,dy]of N4){const a=tx(c)+dx,b=ty(c)+dy;if(!inb(a,b))continue;const k=ix(a,b);if(!seen[k]&&G.t[k]===CLAIM){seen[k]=1;q.push(k);}}}
    for(const i of free)build(i,r);
    if(free.length)msg('Assistant: built '+free.length+' '+ROOMS[r].n+' tile'+(free.length>1?'s':'')+'.','cpu-b'+r);
    recount();if(free.length<need){short=true;break;}
  }
  // 4. out of floor space: dig out a 3x3 block of earth next to your territory, close to the Heart
  if(short&&marksCount()<A.maxMarks/2){
    const p=bfs(ix(G.hx+2,G.hy),i=>G.t[i]===CLAIM&&nb(i,j=>G.t[j]===EARTH||G.t[j]===WALL)>=0,4,i=>G.t[i]===CLAIM);
    if(p){const end=p.length?p[p.length-1]:ix(G.hx+2,G.hy),e=nb(end,j=>G.t[j]===EARTH||G.t[j]===WALL);const blk=[];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=tx(e)+(tx(e)-tx(end))+dx,y=ty(e)+(ty(e)-ty(end))+dy;if(x>0&&y>0&&x<W-1&&y<H-1)blk.push(ix(x,y));}
      blk.push(e);for(const i of blk)if(G.t[i]===WALL&&!G.mark[i])G.mark[i]=1;cpuMark(blk);}
  }
  // 5. enough imps for the size of the dungeon
  let claimed=0;for(let i=0;i<N;i++)claimed+=G.t[i]===CLAIM;
  const imps=G.ents.filter(e=>e.kind==='imp'&&e.side===0).length+G.held.filter(e=>e.kind==='imp').length;
  if(imps<Math.min(A.maxImps,CFG.imp.startCount+Math.floor(claimed/A.impsPerClaimed))&&G.money>impCost()+A.reserveGold){
    const r=[];for(let i=0;i<N;i++)if(G.t[i]===CLAIM&&adjHeart(i))r.push(i);if(r.length){cast('imp',r[rand(r.length)]);msg('Assistant: summoned an imp.','cpu-imp');}}
}
function cpuMove(){
  const heroes=G.ents.filter(e=>e.side===1&&!e.dead&&!e.guard&&G.seen[ti(e)]);
  if(heroes.length){
    const tgt=heroes.reduce((a,b)=>Math.hypot(a.x-G.hx,a.y-G.hy)<Math.hypot(b.x-G.hx,b.y-G.hy)?a:b);
    let drop=-1,bd=9;
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const x=Math.floor(tgt.x)+dx,y=Math.floor(tgt.y)+dy;if(!inb(x,y))continue;const i=ix(x,y),d=Math.hypot(x+.5-tgt.x,y+.5-tgt.y);
      if(G.t[i]===CLAIM&&d>=1.5&&d<bd&&clearShot({x:x+.5,y:y+.5},tgt)){bd=d;drop=i;}}
    if(drop>=0){let n=0;
      for(const e of creatures().filter(e=>activity(e)!=='fighting'&&e.hp>e.maxhp*.6&&Math.hypot(e.x-tgt.x,e.y-tgt.y)>8).sort((a,b)=>b.lvl-a.lvl)){
        if(n>=3||!pickUp(e))break;dropHeld(drop);n++;}
      if(n)msg('Assistant: dropped '+n+' creature'+(n>1?'s':'')+' on the invaders.','cpu-mv');}
    return;
  }
  // in peace time, put one idle creature to work in the Training Room
  if(G.rc[TRAIN]&&G.money>CFG.assistant.reserveGold){const e=creatures().find(e=>activity(e)==='idle'&&e.lvl<10&&e.hunger<80);
    if(e){const t=[];for(let i=0;i<N;i++)if(G.room[i]===TRAIN)t.push(i);if(t.length&&pickUp(e))dropHeld(t[rand(t.length)]);}}
}
function cpuSpells(aggressive){
  const A=CFG.assistant,heroes=G.ents.filter(e=>e.side===1&&!e.dead&&G.seen[ti(e)]&&(aggressive?!e.guard:Math.hypot(e.x-G.hx,e.y-G.hy)<8));
  if(heroes.length&&G.research>=SPELLS.bolt.req&&G.money>SPELLS.bolt.cost+A.reserveGold){
    let best=null,bn=0;for(const h of heroes){const n=heroes.filter(o=>Math.hypot(o.x-h.x,o.y-h.y)<SPELLS.bolt.radius).length;if(n>bn){bn=n;best=h;}}
    if(best)cast('bolt',ti(best),best.x,best.y);
  }
  if(aggressive&&heroes.length&&G.research>=SPELLS.rally.req&&G.money>SPELLS.rally.cost+A.reserveGold&&!(G.rally&&G.time<G.rally.until)){
    const h=heroes[0],p=bfs(ti(h),walk,1,walk,6);if(p&&p.length)cast('rally',p[p.length-1],h.x,h.y);}
  if(!aggressive&&G.research>=SPELLS.heal.req&&G.money>SPELLS.heal.cost+A.reserveGold){
    const hurt=creatures().find(e=>activity(e)==='fighting'&&e.hp<e.maxhp*.4);if(hurt)cast('heal',ti(hurt),hurt.x,hurt.y);}
}
function entAt(fx,fy){let best=null,bd=.42;for(const e of G.ents){if(e.dead||e.held||e.side!==0)continue;const d=Math.hypot(e.x-fx,e.y-fy);if(d<bd){bd=d;best=e;}}return best;}
function slapAt(fx,fy){const e=entAt(fx,fy);if(!e)return;e.slap=10;e.hp-=4;fx({type:'text',x:e.x,y:e.y-.3,dur:.6,txt:'Slap!',col:'#ffd2a8'});if(e.hp<=0){kill(e);return;}if(e.kind!=='imp'&&e.state!=='fight'){release(e);e.state='think';}}
function build(i,r){
  if(G.t[i]!==CLAIM||G.room[i])return false;const c=ROOMS[r].cost;
  if(G.money<c){msg('Not enough gold for a '+ROOMS[r].n+'.','nogold','bad');return false;}
  G.money-=c;G.room[i]=r;fx({type:'ring',x:tx(i)+.5,y:ty(i)+.5,dur:.4,col:ROOMS[r].col});return true;
}
function sell(i){const r=G.room[i];if(!r)return;G.room[i]=0;G.money+=Math.floor(ROOMS[r].cost/2);}
function applyRect(mode,R){
  for(let y=R.y0;y<=R.y1;y++)for(let x=R.x0;x<=R.x1;x++){const i=ix(x,y);if(!affects(mode,i))continue;
    if(mode==='mark'){if(diggable(i))G.mark[i]=1;}else if(mode==='unmark')G.mark[i]=0;else if(mode==='sell')sell(i);else if(!build(i,+mode)){y=R.y1;break;}}
  recount();
  if(G.money>cap()){msg('Not all the gold fit in your treasuries.','lost','bad');G.money=cap();}
}
function recount(){G.rc=[0,0,0,0,0,0];for(let i=0;i<N;i++)if(G.room[i])G.rc[G.room[i]]++;}
// Dungeon Keeper: a slapped imp works 25% faster for a while.
const SLAP_BOOST=1.25;
function impCost(){return CFG.imp.baseCost+CFG.imp.perImp*G.ents.filter(e=>e.kind==='imp').length;}
// Call to Arms is free on your own territory, as in Dungeon Keeper.
function spellCost(k,i){return k==='imp'?impCost():k==='rally'&&i!==undefined&&G.t[i]===CLAIM?0:SPELLS[k].cost;}
function cast(k,i,fx_,fy_){
  const s=SPELLS[k];if(G.research<s.req){msg(s.n+' has not been researched yet.','req','bad');return;}
  const c=spellCost(k,i);if(G.money<c){msg('Not enough gold for '+s.n+'.','nogold','bad');return;}
  if(k==='imp'){if(G.t[i]!==CLAIM)return;const e=spawn('imp',tx(i),ty(i));fx({type:'ring',x:e.x,y:e.y,dur:.6,col:'#e0483c'});}
  else if(k==='bolt'){if(!G.seen[i])return;fx({type:'bolt',x:fx_,y:fy_,dur:.45,seed:rand(999)});for(const o of G.ents){if(o.dead||o.side!==1)continue;if(Math.hypot(o.x-fx_,o.y-fy_)<s.radius){o.hp-=s.damage;fx({type:'text',x:o.x,y:o.y-.3,dur:.8,txt:'-'+s.damage,col:'#dfe9ff'});if(o.hp<=0)kill(o);}}}
  else if(k==='heal'){fx({type:'heal',x:fx_,y:fy_,dur:.6});for(const o of G.ents)if(!o.dead&&o.side===0&&Math.hypot(o.x-fx_,o.y-fy_)<s.radius)o.hp=o.maxhp;}
  else if(k==='rally'){if(!G.seen[i]||!walk(i))return;G.rally={i,until:G.time+s.duration};for(const o of creatures())if(o.state!=='fight'&&o.state!=='leave'){release(o);o.state='think';}msg('Your creatures rally to arms.','rally','good');}
  G.money-=c;
}
function scr(ev){const r=cv.getBoundingClientRect();return{sx:ev.clientX-r.left,sy:ev.clientY-r.top};}
function evPos(ev){const{sx,sy}=scr(ev);const fx_=(sx-cam.x)/TS,fy_=(sy-cam.y)/TS;return{sx,sy,fx:fx_,fy:fy_,x:Math.floor(fx_),y:Math.floor(fy_)};}
const ptrs=new Map();let pinch=null,pan=null;
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',ev=>{
  const p=evPos(ev);cv.setPointerCapture(ev.pointerId);ptrs.set(ev.pointerId,p);hover={...p,in:true};
  if(ptrs.size===2){drag=null;pan=null;const[a,b]=[...ptrs.values()];const mx=(a.sx+b.sx)/2,my=(a.sy+b.sy)/2;
    pinch={d:Math.hypot(a.sx-b.sx,a.sy-b.sy)||1,z:Z,wx:(mx-cam.x)/TS,wy:(my-cam.y)/TS};return;}
  if(ev.button===1||ev.button===2||tool==='look'){pan={sx:p.sx,sy:p.sy,cx:cam.x,cy:cam.y,moved:false,slap:ev.button===2};cv.classList.add('grab');return;}
  if(!running||G.over||!inb(p.x,p.y))return;const i=ix(p.x,p.y);
  if(tool==='slap'){slapAt(p.fx,p.fy);return;}
  if(tool==='hand'){
    const e=entAt(p.fx,p.fy);
    if(e){pickUp(e);return;}
    if(G.held.length&&ownPortal(i)&&G.held[G.held.length-1].kind!=='imp'){const d=G.held.pop();d.dead=true;toPool(d);fx({type:'ring',x:p.x+.5,y:p.y+.5,dur:.6,col:'#c58cff'});msg('You dismissed your '+KINDS[d.kind].n+' through the portal.','dis'+d.id);return;}
    if(G.held.length&&(G.t[i]===CLAIM||ownPortal(i))){dropHeld(i);return;}
    if(G.held.length&&G.seen[i]){msg('You can only drop creatures on your own territory.','dropbad','bad');return;}
    drag={mode:G.mark[i]&&diggable(i)?'unmark':'mark',x0:p.x,y0:p.y,x1:p.x,y1:p.y};return;
  }
  if(ROOMS[tool]||tool==='sell'){drag={mode:String(tool),x0:p.x,y0:p.y,x1:p.x,y1:p.y};return;}
  if(SPELLS[tool])cast(tool,i,p.fx,p.fy);
});
cv.addEventListener('pointermove',ev=>{
  if(!pan&&!pinch)cv.style.cursor=tool==='hand'&&G&&entAt((ev.clientX-cv.getBoundingClientRect().left-cam.x)/TS,(ev.clientY-cv.getBoundingClientRect().top-cam.y)/TS)?'grab':'';
  const p=evPos(ev);if(ptrs.has(ev.pointerId))ptrs.set(ev.pointerId,p);hover={...p,in:true};
  if(pinch&&ptrs.size===2){const[a,b]=[...ptrs.values()];const mx=(a.sx+b.sx)/2,my=(a.sy+b.sy)/2;
    Z=Math.max(1,Math.min(4,pinch.z*Math.hypot(a.sx-b.sx,a.sy-b.sy)/pinch.d));TS=BASE*Z;cam.x=mx-pinch.wx*TS;cam.y=my-pinch.wy*TS;clampCam();return;}
  if(pan){const dx=p.sx-pan.sx,dy=p.sy-pan.sy;if(Math.hypot(dx,dy)>4)pan.moved=true;if(pan.moved){cam.x=pan.cx+dx;cam.y=pan.cy+dy;clampCam();}return;}
  if(drag){drag.x1=Math.max(0,Math.min(W-1,p.x));drag.y1=Math.max(0,Math.min(H-1,p.y));}
  updateTip();
});
const endPtr=ev=>{
  ptrs.delete(ev.pointerId);if(ptrs.size<2)pinch=null;
  if(pan&&ptrs.size===0){if(!pan.moved&&pan.slap&&running&&!G.over)slapAt(hover.fx,hover.fy);pan=null;cv.classList.toggle('grab',tool==='look');}
  if(drag&&ev.type==='pointerup'&&G&&!G.over)applyRect(drag.mode,dragRect());
  drag=null;updateTip();
};
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('pointerleave',()=>{hover.in=false;});
cv.addEventListener('wheel',ev=>{ev.preventDefault();const{sx,sy}=scr(ev);zoomAt(Z*(ev.deltaY<0?1.15:1/1.15),sx,sy);},{passive:false});
function updateTip(){
  const tip=document.getElementById('tip'),R=dragRect();
  if(!R||(R.x0===R.x1&&R.y0===R.y1)){tip.hidden=true;return;}
  let n=0;for(let y=R.y0;y<=R.y1;y++)for(let x=R.x0;x<=R.x1;x++)if(affects(drag.mode,ix(x,y)))n++;
  tip.textContent=drag.mode==='mark'?'Dig '+n+' block'+(n===1?'':'s'):drag.mode==='unmark'?'Cancel '+n+' block'+(n===1?'':'s'):drag.mode==='sell'?'Sell '+n+' tile'+(n===1?'':'s'):ROOMS[drag.mode].n+' × '+n+' · '+n*ROOMS[drag.mode].cost+' gold';
  tip.hidden=false;tip.style.left=Math.min(hover.sx+14,SW-170)+'px';tip.style.top=(hover.sy+16)+'px';
}

/* ---------- interface ---------- */
const btns={};
function buildTools(){
  const defs={
    hand:{el:'tHand',n:'Hand',sub:'dig · pick up · drop'},
    slap:{el:'tHand',n:'Slap',sub:'or right-click'},
    look:{el:'tHand',n:'Look',sub:'drag to scroll'},
  };
  for(const[k,r]of Object.entries(ROOMS))defs[k]={el:'tRooms',n:r.n,sub:r.cost+' gold per tile',col:r.col};
  defs.sell={el:'tRooms',n:'Sell',sub:'half price back'};
  for(const[k,s]of Object.entries(SPELLS))defs[k]={el:'tSpells',n:s.n,sub:''};
  for(const el of['tHand','tRooms','tSpells'])document.getElementById(el).innerHTML='';
  for(const k in btns)delete btns[k];
  for(const[k,d]of Object.entries(defs)){
    const b=document.createElement('button');b.type='button';b.className='tool';b.id='tool-'+k;
    b.innerHTML='<b>'+(d.col?'<i class="sw" style="background:'+d.col+'"></i>':'')+d.n+'</b><span>'+d.sub+'</span>';
    b.onclick=()=>setTool(k);document.getElementById(d.el).appendChild(b);btns[k]=b;
  }
  setTool(btns[tool]?tool:'hand');
}
function setTool(k){tool=k;for(const[n,b]of Object.entries(btns))b.classList.toggle('on',n===k);cv.classList.toggle('grab',k==='look');}
buildTools();
const fmtT=s=>{s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const TILE_EN={0:'Rock (impenetrable)',1:'Earth',2:'Gold seam',3:'Gem seam (never runs out)',4:'Unclaimed ground',5:'Your territory',6:'Dungeon Heart',8:'Hero Gate',9:'Lava',10:'Reinforced wall (slows heroes down)'};
function ui(){
  const $=id=>document.getElementById(id);
  $('sGold').textContent=Math.floor(G.money)+' / '+cap();
  $('sImps').textContent=G.ents.filter(e=>e.kind==='imp'&&e.side===0).length+G.held.filter(e=>e.kind==='imp').length;
  $('sCre').textContent=creatures().length+G.held.filter(e=>e.kind!=='imp').length+' / '+G.rc[LAIR];
  $('sRes').textContent=Math.floor(G.research);
  const due=creatures().concat(G.held.filter(e=>e.kind!=='imp')).reduce((a,e)=>a+wage(e.kind),0);
  $('sPay').textContent=fmtT(G.payT)+(due?' · '+due+'g':'');$('sPay').style.color=due>G.money?'#f08a7e':'';
  $('sWave').textContent=G.wave>=WAVES.length?'final wave':('wave '+(G.wave+1)+' in '+fmtT(G.nextWave));
  $('sHeart').style.width=(100*G.heartHP/G.heartMax)+'%';
  for(const[k,s]of Object.entries(SPELLS)){const b=btns[k],locked=G.research<s.req;b.disabled=locked;
    b.querySelector('span').textContent=locked?('research '+s.req):(spellCost(k)+' gold');}
  let h='';
  if(hover.in&&inb(hover.x,hover.y)){
    const i=ix(hover.x,hover.y);
    const e=G.ents.find(o=>!o.dead&&!o.held&&(o.side===0||G.seen[ti(o)])&&Math.hypot(o.x-hover.fx,o.y-hover.fy)<.45);
    if(!G.seen[i])h='<b>Unexplored</b>'+(G.t[i]===GOLD?' · gold glints through':G.t[i]===GEM?' · gems glint through':'')+(G.mark[i]?'<br>Marked for digging':'')+'<br>You can mark it for digging. Your imps will find out what is there.';
    else if(e){const k=KINDS[e.kind];h='<b>'+(e.side===2?'Unknown creature':k.n)+'</b>'+(e.side===1?' · hero':'')+' · level '+e.lvl+'<br>'+Math.ceil(e.hp)+' / '+Math.ceil(e.maxhp)+' health · '+STATE_EN[e.state];
      if(e.side===0&&e.kind!=='imp')h+='<br>Wage '+wage(e.kind)+' · hunger '+Math.floor(Math.min(100,e.hunger))+'%';if(e.carry)h+='<br>Carrying '+e.carry+' gold';}
    else{const t=G.t[i];
      h='<b>'+(t===PORTAL?(G.pown[i]?'Portal (yours)':'Portal (not yet claimed)'):TILE_EN[t])+'</b>';if(t===PORTAL)h+=G.pown[i]?'<br>Drop a creature here to dismiss it.':'<br>Claim the ground next to it, then your imps claim the portal.';if(t===GOLD)h+=' · '+G.gold[i]+' gold';if(G.mark[i])h+='<br>Marked for digging';
      if(G.loot[i])h+='<br>Treasure chest: '+G.loot[i]+' gold';
      if(G.room[i])h+='<br>'+ROOMS[G.room[i]].n+': '+ROOMS[G.room[i]].tip.toLowerCase();}
  }else if(ROOMS[tool])h='<b>'+ROOMS[tool].n+'</b><br>'+ROOMS[tool].tip+'. Click a tile, or drag a rectangle over your territory.';
  else if(tool==='hand')h=G.held.length?'<b>In hand: '+G.held.length+'</b><br>Click your territory to drop.':'<b>Hand</b><br>Click a block to dig it, or drag to mark an area. Click a creature to pick it up.';
  else if(SPELLS[tool])h='<b>'+SPELLS[tool].n+'</b><br>'+({imp:'Click your territory to summon a new imp.',bolt:'Strikes heroes around the clicked spot.',heal:'Heals your creatures around the clicked spot.',rally:'All creatures gather at this spot for 20 seconds. Free on your own territory.'})[tool];
  else if(tool==='sell')h='<b>Sell</b><br>Click or drag over rooms to tear them down.';
  else if(tool==='look')h='<b>Look</b><br>Drag to scroll the map. Scroll or pinch to zoom.';
  else h='<b>Slap</b><br>A slapped imp works faster for 10 seconds.';
  const info=$('info');if(info.innerHTML!==h)info.innerHTML=h;
  const n=creatures().length+G.held.filter(e=>e.kind!=='imp').length;
  let ph='';
  if(!anyPortal())ph='<li><span class="need">Claim a portal to attract creatures. No portal, no creatures.</span></li>';
  for(const[k,a]of Object.entries(ATTRACT)){const ok=a.ok();ph+='<li class="'+(ok?'ok':'')+'"><i class="dot" style="background:'+KINDS[k].col+'"></i><b>'+KINDS[k].n+'</b><span class="n">'+G.pool[k]+' left</span><span class="need">'+(ok?'✓ ':'Needs ')+a.need+'</span></li>';}
  ph+='<li><span class="need">Creatures: '+n+' / '+PORTAL_LIMIT+' · free beds: '+Math.max(0,G.rc[LAIR]-n)+(anyPortal()?' · next arrival in '+fmtT(G.portalT):'')+'</span></li>';
  const pl=$('pool');if(pl.innerHTML!==ph)pl.innerHTML=ph;
  // Info tab gauges, as in Dungeon Keeper's information panel
  $('gPay').style.width=(100*(1-G.payT/ECON.payInterval))+'%';$('gPayTxt').textContent=fmtT(G.payT)+' · wages '+due;$('gPayTxt').classList.toggle('bad',due>G.money);
  const nextSp=Object.values(SPELLS).filter(s=>s.req>G.research).sort((a,b)=>a.req-b.req)[0];
  $('gRes').style.width=(nextSp?100*G.research/nextSp.req:100)+'%';$('gResTxt').textContent=nextSp?Math.floor(G.research)+' / '+nextSp.req+' → '+nextSp.n:'all spells researched';
  if(tab==='creatures'){
    let gh='<span></span><span class="h">Idle</span><span class="h">Working</span><span class="h">Fighting</span>';
    const mine=G.ents.filter(e=>!e.dead&&e.side===0);
    for(const k of CR_ORDER()){const of=mine.filter(e=>e.kind===k&&!e.held);const held=G.held.filter(e=>e.kind===k).length;if(!of.length&&!held)continue;
      const src=ASSETS['units.'+k],cnt=a=>of.filter(e=>activity(e)===a).length;
      gh+='<button type="button" class="who" data-k="'+k+'" title="Pick up the most experienced '+KINDS[k].n+'">'+(src?'<img src="'+src+'" alt="">':'<i style="background:'+KINDS[k].col+'"></i>')+'<span>'+KINDS[k].n+(held?' <small>('+held+' in hand)</small>':'')+'</span></button>';
      for(const a of['idle','working','fighting']){const n=cnt(a);gh+='<button type="button" class="num'+(a==='fighting'&&n?' f':'')+'" data-k="'+k+'" data-a="'+a+'" aria-label="'+n+' '+a+' '+KINDS[k].n+(n?': pick one up':'')+'"'+(n?'':' disabled')+'>'+n+'</button>';}}
    if(gh.split('class="who"').length===1)gh+='<span class="h" style="grid-column:1/-1;text-align:left">No creatures yet.</span>';
    const g=$('crGrid');if(g.innerHTML!==gh)g.innerHTML=gh;
    const list=mine.concat().filter(e=>e.kind!=='imp').sort((a,b)=>CR_ORDER().indexOf(a.kind)-CR_ORDER().indexOf(b.kind)||b.lvl-a.lvl);
    const lh=list.map(e=>'<li><button type="button" data-id="'+e.id+'" title="Look at this creature"><span class="nm">'+KINDS[e.kind].n+' <small>'+(e.held?'in your hand':STATE_EN[e.state==='walk'?e.next||'walk':e.state]||e.state)+'</small></span><span class="lv">'+e.lvl+'</span><span class="hp"><i style="width:'+Math.round(100*Math.max(0,e.hp/e.maxhp))+'%;background:'+(e.hp<e.maxhp*.35?'#e0483c':'#5fcf6a')+'"></i></span></button></li>').join('');
    const l=$('crList');if(l.innerHTML!==lh)l.innerHTML=lh;
  }
  const hd=$('held'),hh=G.held.length?'<span>In hand '+G.held.length+'/'+CFG.hand.capacity+' · next drop:</span>'+G.held.slice().reverse().map((e,n)=>'<button type="button" data-id="'+e.id+'" class="'+(n?'':'top')+'" title="Drop this one next"><i class="dot" style="background:'+KINDS[e.kind].col+'"></i>'+KINDS[e.kind].n+(e.lvl>1?' '+e.lvl:'')+'</button>').join(''):'';
  hd.hidden=!G.held.length;if(hd.innerHTML!==hh)hd.innerHTML=hh;
}
function syncCpu(){const c=G.cpu;const b=document.getElementById('bCpu');b.setAttribute('aria-pressed',String(c.on));b.title='Computer Assistant: '+(c.on?'on ('+c.mode+')':'off');
  document.getElementById('cpuModes').hidden=!c.on;for(const m of document.querySelectorAll('#cpuSeg button'))m.setAttribute('aria-pressed',String(m.dataset.mode===c.mode));}
let tab='info';
function showTab(t){tab=t;for(const b of document.querySelectorAll('#tabs button'))b.setAttribute('aria-selected',String(b.dataset.tab===t));
  for(const s of document.querySelectorAll('.tab'))s.hidden=s.id!=='tab-'+t;try{localStorage.setItem('underlord-tab',t);}catch(e){}if(G)ui();}
const CR_ORDER=()=>['imp',...Object.keys(ATTRACT)];
function crPick(kind,act,look){
  const list=G.ents.filter(e=>!e.dead&&!e.held&&e.side===0&&e.kind===kind&&(!act||activity(e)===act)).sort((a,b)=>b.lvl-a.lvl||a.id-b.id);if(!list.length)return;
  const key=kind+act;G.crCycle=G.crCycle||{};const k=act?(G.crCycle[key]=((G.crCycle[key]??-1)+1)%list.length):0,e=list[k];
  if(look)centerOn(e.x-.5,e.y-.5);else if(pickUp(e))msg('You picked up your '+KINDS[kind].n+'.','pick'+e.id);
  ui();
}
function unknownHeroes(){return G.ents.filter(e=>e.side===1&&!e.dead&&!e.guard&&!G.seen[ti(e)]);}
function drawMini(){
  const m=document.getElementById('mini');const w=m.clientWidth;if(!w)return;const d=window.devicePixelRatio||1,h=Math.round(w*H/W);
  if(m.width!==Math.round(w*d)){m.width=Math.round(w*d);m.height=Math.round(h*d);}
  const c=m.getContext('2d'),s=m.width/W;c.setTransform(1,0,0,1,0,0);
  const col={[ROCK]:'#121116',[EARTH]:'#4b3423',[GOLD]:'#d6a52a',[GEM]:'#56d6ea',[FLOOR]:'#2a211b',[CLAIM]:'#6a2620',[HEART]:'#ff4a3a',[PORTAL]:'#c24bd6',[GATE]:'#bcd2f0',[LAVA]:'#e0561b',[WALL]:'#6b5d55'};
  for(let i=0;i<N;i++){const t=G.t[i];c.fillStyle=!G.seen[i]?(t===GOLD||t===GEM?'#5a4416':'#0c0a0f'):G.room[i]?ROOMS[G.room[i]].col:col[t];c.fillRect(tx(i)*s,ty(i)*s,Math.ceil(s),Math.ceil(s));}
  for(const P of G.portals){c.fillStyle=G.pown[P]?'#ff6ad5':'#8a6ab0';c.fillRect((tx(P)-.25)*s,(ty(P)-.25)*s,s*1.5,s*1.5);}
  for(const e of unknownHeroes()){c.fillStyle='#ffffff';c.beginPath();c.arc(e.x*s,e.y*s,s*.45,0,Math.PI*2);c.fill();}
  for(const e of G.ents){if(e.dead||e.held||(e.side!==0&&!G.seen[ti(e)]))continue;c.fillStyle=e.side===1?'#8fb4ef':e.side===2?'#9a928a':e.kind==='imp'?'#ffb070':'#ffe2a0';c.fillRect(e.x*s-s*.4,e.y*s-s*.4,s*.8,s*.8);}
  c.strokeStyle='rgba(255,240,220,.85)';c.lineWidth=Math.max(1,d);c.strokeRect(-cam.x/TS*s,-cam.y/TS*s,SW/TS*s,SH/TS*s);
}
function syncPause(){document.getElementById('bPause').textContent=paused?'Resume':'Pause';}
document.getElementById('bPause').onclick=()=>{paused=!paused;syncPause();};
function setSpeed(n){speed=n;const b=document.getElementById('bSpeed');b.textContent=n+'×';b.setAttribute('aria-label','Game speed: '+n+'×');}
document.getElementById('bSpeed').onclick=()=>setSpeed(speed===1?2:speed===2?3:1);
document.getElementById('zin').onclick=()=>zoomAt(Z*1.25,SW/2,SH/2);
document.getElementById('zout').onclick=()=>zoomAt(Z/1.25,SW/2,SH/2);
document.getElementById('zfit').onclick=()=>zoomAt(1,SW/2,SH/2);
document.getElementById('bStart').onclick=()=>{newGame();document.getElementById('ov').hidden=true;running=true;};
document.getElementById('bContinue').onclick=()=>loadGame();
const CHEATS=[
  ['+500 gold',()=>{G.money+=500;return '+500 gold';}],
  ['+5000 gold',()=>{G.money+=5000;return '+5000 gold';}],
  ['Reveal map',()=>{G.seen.fill(1);G.fogDirty=true;return 'map revealed';}],
  ['Finish research',()=>{research(Math.max(0,...Object.values(SPELLS).map(s=>s.req||0))-G.research);return 'all spells unlocked';}],
  ['Restore Heart',()=>{G.heartHP=G.heartMax;return 'Heart restored';}],
  ['Free imp',()=>{const r=[];for(let i=0;i<N;i++)if(G.t[i]===CLAIM)r.push(i);const i=r[rand(r.length)];spawn('imp',tx(i),ty(i));return 'free imp';}],
  ...['orc','warlock','troll','mistress'].map(k=>['+ '+KINDS[k].n,()=>{const p=G.portals.find(q=>G.pown[q]);const i=p!==undefined?p:ix(G.hx+2,G.hy);const e=spawn(k,tx(i),ty(i));fx({type:'ring',x:e.x,y:e.y,dur:.8,col:'#c58cff'});return KINDS[k].n+' summoned';}]),
  ['Level up all',()=>{for(const e of creatures())gainXP(e,need(e)-e.xp);return 'creatures levelled up';}],
  ['Next wave now',()=>{if(G.wave>=WAVES.length)return 'no waves left';G.nextWave=0;return 'next wave called';}],
  ['Defeat heroes',()=>{let n=0;for(const e of G.ents)if(e.side===1&&!e.dead){kill(e);n++;}return n+' heroes defeated';}],
];
// The Cheats panel is hidden until someone types the cheat code. It is not remembered: a reload locks it again.
const CHEAT_CODE='iliketocheat';let cheatsOn=false,typed='';
for(const[label,fn]of CHEATS){const b=document.createElement('button');b.type='button';b.textContent=label;
  b.onclick=()=>{if(!running||G.over)return;const r=fn();msg('Cheat: '+r+'.','cheat'+G.time+label,'good');};document.getElementById('cheatList').appendChild(b);}
function toggleCheats(open){const c=document.getElementById('cheats'),b=document.getElementById('bCheat');if(!c||!b||!cheatsOn)return;open=open??c.hidden;c.hidden=!open;b.setAttribute('aria-expanded',String(open));}
function unlockCheats(){
  cheatsOn=true;document.getElementById('bCheat').hidden=false;toggleCheats(true);
  if(G)msg('Cheat mode unlocked.','cheatcode','good');
}
document.getElementById('bCheat').onclick=()=>toggleCheats();
document.getElementById('tabs').onclick=ev=>{const b=ev.target.closest('button[data-tab]');if(b)showTab(b.dataset.tab);};
document.getElementById('bCpu').onclick=()=>{G.cpu.on=!G.cpu.on;G.cpu.t=0;syncCpu();msg('Computer Assistant '+(G.cpu.on?'on ('+G.cpu.mode+')':'off')+'.','cpu'+G.time);};
document.getElementById('cpuSeg').onclick=ev=>{const b=ev.target.closest('button[data-mode]');if(!b)return;G.cpu.mode=b.dataset.mode;syncCpu();};
const crg=document.getElementById('crGrid');
crg.onclick=ev=>{const b=ev.target.closest('button[data-k]');if(!b||!running)return;crPick(b.dataset.k,b.dataset.a||'',false);};
crg.oncontextmenu=ev=>{const b=ev.target.closest('button[data-k]');if(!b)return;ev.preventDefault();crPick(b.dataset.k,b.dataset.a||'',true);};
document.getElementById('crList').onclick=ev=>{const b=ev.target.closest('button[data-id]');if(!b)return;const e=G.ents.find(o=>o.id===+b.dataset.id);if(e&&!e.held)centerOn(e.x-.5,e.y-.5);};
{const m=document.getElementById('mini');let down=false;
  const go=ev=>{const r=m.getBoundingClientRect();centerOn((ev.clientX-r.left)/r.width*W-.5,(ev.clientY-r.top)/r.height*H-.5);};
  m.addEventListener('pointerdown',ev=>{down=true;m.setPointerCapture(ev.pointerId);go(ev);});
  m.addEventListener('pointermove',ev=>{if(down)go(ev);});
  m.addEventListener('pointerup',()=>{down=false;});m.addEventListener('pointercancel',()=>{down=false;});}
try{const t=localStorage.getItem('underlord-tab');if(t)tab=t;}catch(e){}
document.getElementById('held').onclick=ev=>{const b=ev.target.closest('button[data-id]');if(!b)return;const k=G.held.findIndex(e=>e.id===+b.dataset.id);if(k>=0){G.held.push(G.held.splice(k,1)[0]);ui();}};
document.getElementById('bSave').onclick=()=>{if(running)saveGame(false);};
document.getElementById('bLoad').onclick=()=>loadGame();
const keys=new Set();
addEventListener('keydown',e=>{
  if(!cheatsOn&&e.key.length===1){typed=(typed+e.key.toLowerCase()).slice(-CHEAT_CODE.length);if(typed===CHEAT_CODE){unlockCheats();return;}}
  if(e.target.tagName==='BUTTON'&&(e.key===' '||e.key==='Enter'))return;
  if(e.key===' '||e.key==='p'){e.preventDefault();paused=!paused;syncPause();}
  else if(e.key==='Escape'){setTool('hand');drag=null;updateTip();toggleCheats(false);}
  else if(e.key==='`'||e.key==='c'&&e.ctrlKey){e.preventDefault();toggleCheats();}
  else if(e.key>='1'&&e.key<='3')setSpeed(+e.key);
  else if(e.key==='+'||e.key==='=')zoomAt(Z*1.25,SW/2,SH/2);
  else if(e.key==='-'||e.key==='_')zoomAt(Z/1.25,SW/2,SH/2);
  else{const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(k)){e.preventDefault();keys.add(k);}}
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());

function resize(){
  const r=stage.getBoundingClientRect();SW=Math.max(100,r.width-2);SH=Math.max(80,r.height-2);
  const wx=(SW/2-cam.x)/TS,wy=(SH/2-cam.y)/TS;
  BASE=Math.min(SW/W,SH/H);TS=BASE*Z;
  DPR=window.devicePixelRatio||1;cv.width=Math.round(SW*DPR);cv.height=Math.round(SH*DPR);
  cv.style.width=SW+'px';cv.style.height=SH+'px';makeCloud();
  if(!camInit&&G){camInit=true;centerOn(G.hx,G.hy);}else{cam.x=SW/2-wx*TS;cam.y=SH/2-wy*TS;clampCam();}
}
new ResizeObserver(resize).observe(stage);

let last=performance.now(),uiT=0,autoT=120;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(running&&!paused){for(let k=0;k<speed;k++)update(dt);if((autoT-=dt)<=0){autoT=120;saveGame(true);}}
  if(keys.size){const v=700*dt;if(keys.has('arrowleft')||keys.has('a'))cam.x+=v;if(keys.has('arrowright')||keys.has('d'))cam.x-=v;if(keys.has('arrowup')||keys.has('w'))cam.y+=v;if(keys.has('arrowdown')||keys.has('s'))cam.y-=v;clampCam();}
  draw();
  if((uiT-=dt)<=0){uiT=.2;ui();drawMini();}
  requestAnimationFrame(frame);
}
newGame();resize();requestAnimationFrame(frame);showTab(tab);syncCpu();
refreshContinue();
