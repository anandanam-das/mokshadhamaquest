(async () => {
'use strict';
const root=document.getElementById('previewRoot');
const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const world=window.MOKSHA_SIGNS_WORLD;
let storageKey=world.storageKey;
if (!local) {
  document.getElementById('resetPreview').hidden = true;
  try {
    const access = await checkSubscription();
    if (!access.hasSignsAccess) {
      location.replace('checking.html?block=signs');
      return;
    }
    storageKey = world.storageKey + ':' + access.telegramId;
    document.getElementById('onlinePreviewLabel').hidden = false;
    document.getElementById('signsCabinetLink').hidden = false;
    document.getElementById('resetPreview').hidden = false;
  } catch (error) {
    if (error.status === 401) location.replace('login.html');
    else root.textContent = 'Не удалось проверить доступ. Обнови страницу или попробуй позже.';
    return;
  }
}
let saved;
try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{saved={};}
if(new URLSearchParams(location.search).get('restart')==='1'){saved={};localStorage.removeItem(storageKey);history.replaceState({},'',location.pathname);}
let state={entered:true,stage:['shiva','map','kailash','shiva-depths','coast','shiva-indra','indra','aries','mangala','indra-taurus','shukra','taurus','indra-gemini','budha','gemini','indra-cancer','cancer'].includes(saved.stage)?saved.stage:'shiva',testBhriguFinished:saved.testBhriguFinished===true,testVarunaFinished:saved.testVarunaFinished===true,indraJoined:saved.indraJoined===true,ariesRestored:saved.ariesRestored===true,taurusUnlocked:saved.taurusUnlocked===true,taurusRestored:saved.taurusRestored===true,geminiUnlocked:saved.geminiUnlocked===true,geminiRestored:saved.geminiRestored===true,cancerUnlocked:saved.cancerUnlocked===true,cancerRestored:saved.cancerRestored===true};
let revealGeneration=0;
function setView(intro) {
  document.body.classList.toggle('intro-active',intro);
  document.querySelector('.topbar').hidden=intro;
  const companion=document.getElementById('indraCompanion');
  companion.hidden=intro || !state.indraJoined;
  if (!companion.hidden && !companion.hasAttribute('src')) {
    companion.src='assets/signs/characters/indra-idle.webp';
  }
}
let dialogue=null,returnFocus=null,typeTimer=null,finishTyping=null;
function stopTyping(){clearInterval(typeTimer);typeTimer=null;finishTyping=null;}
function typeText(node,text,done){
 stopTyping();node.textContent='';node.setAttribute('aria-label',text);node.setAttribute('aria-live','off');
 let i=0;
 const finish=()=>{clearInterval(typeTimer);typeTimer=null;node.textContent=text;finishTyping=null;done?.();};
 finishTyping=finish;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
 typeTimer=setInterval(()=>{i+=2;node.textContent=text.slice(0,i);if(i>=text.length)finish();},28);
}
const dialog=document.getElementById('storyDialog');
function save(){localStorage.setItem(storageKey,JSON.stringify(state));}
function button(text,fn,className=''){const b=document.createElement('button');b.textContent=text;b.className='btn '+(className==='primary'?'btn-primary':className||'btn-secondary');b.addEventListener('click',fn);return b;}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
function startStory(kind) {
  setView(true);
  returnFocus=document.activeElement;
  const scenes={
    shiva:world.shivaIntro,
    'shiva-depths':world.shivaDepths,
    'shiva-indra':world.shivaIndra,
    indra:world.indraMeeting,
    'indra-taurus':world.indraTaurus,
    'indra-gemini':world.indraGemini,
    'indra-cancer':world.indraCancer
  };
  dialogue={kind,index:0,lines:scenes[kind]};
  renderStory();
  if(!dialog.open)dialog.showModal();
}
function renderStory() {
  const line=dialogue.lines[dialogue.index];
  const shiva=document.getElementById('storyPortrait');
  const indra=document.getElementById('storyIndra');
  const meeting=['indra','indra-taurus','indra-gemini','indra-cancer'].includes(dialogue.kind);
  const speaker=meeting ? line.speaker : 'shiva';
  const addressingPlayer=speaker==='indra-idle';
  shiva.hidden=addressingPlayer;
  indra.hidden=!meeting;
  dialog.classList.toggle('indra-meeting',meeting && !addressingPlayer);
  shiva.classList.toggle('story-listening',speaker!=='shiva');
  indra.classList.toggle('story-listening',speaker==='shiva');
  indra.classList.toggle('facing-shiva',speaker==='indra-dialogue');
  if(meeting)indra.src='assets/signs/characters/'+(addressingPlayer?'indra-idle':'indra-dialogue')+'.webp';
  const next=document.getElementById('storyNext');
  const lastLabels={'shiva-indra':'Призвать Индру',indra:'К обители','indra-taurus':'К обители','indra-gemini':'К обители','indra-cancer':'К обители'};
  next.textContent='Показать весь текст';
  typeText(document.getElementById('storyText'),meeting?line.text:line,()=>{
    next.textContent=dialogue.index<dialogue.lines.length-1?'Далее':(lastLabels[dialogue.kind]||'Открыть обитель');
  });
  document.getElementById('storyCounter').textContent=(dialogue.index+1)+' / '+dialogue.lines.length;
}
document.getElementById('storyNext').addEventListener('click',()=>{
  if(finishTyping){finishTyping();return;}
  if(++dialogue.index<dialogue.lines.length){renderStory();return;}
  const kind=dialogue.kind;
  if(kind==='shiva-indra'){
    state.stage='indra';
    save();
    startStory('indra');
    return;
  }
  dialog.close();
  dialogue=null;
  if(kind==='indra')state.indraJoined=true;
  if(kind==='indra-taurus')state.taurusUnlocked=true;
  if(kind==='indra-gemini')state.geminiUnlocked=true;
  if(kind==='indra-cancer')state.cancerUnlocked=true;
  state.stage='map';
  save();
  renderMap(kind==='shiva');
});
dialog.addEventListener('cancel',event=>event.preventDefault());
dialog.addEventListener('close',()=>{stopTyping();if(returnFocus?.isConnected)returnFocus.focus();});
document.getElementById('resetPreview').addEventListener('click',()=>{if(dialog.open)dialog.close();state={entered:true,stage:'shiva'};localStorage.removeItem(storageKey);render();});
function render(){
 stopTyping();root.replaceChildren();
 if(state.stage==='kailash')renderLocation('kailash');
 else if(state.stage==='map')renderMap();
 else if(state.stage==='coast')renderLocation('coast');
 else if(state.stage==='indra')startStory('indra');
 else if(state.stage==='aries')renderAriesHall();
 else if(state.stage==='mangala')renderMangalaRooms();
 else if(state.stage==='shukra')renderShukraRooms();
 else if(state.stage==='taurus')renderTaurusKitchen();
 else if(state.stage==='indra-taurus')startStory('indra-taurus');
 else if(state.stage==='indra-gemini')startStory('indra-gemini');
 else if(state.stage==='budha')renderBudhaRooms();
 else if(state.stage==='gemini')renderGeminiHall();
 else if(state.stage==='indra-cancer')startStory('indra-cancer');
 else if(state.stage==='cancer')renderCancerBaths();
 else startStory(state.stage==='shiva-indra'?'shiva-indra':state.stage==='shiva-depths'?'shiva-depths':'shiva');
}
function addMapLabel(node, name) {
  const label=el('span','village-building-label signs-building-label',name);
  label.setAttribute('aria-hidden','true');
  node.append(label);
}
async function renderMap(reveal=false){
 const generation=++revealGeneration;
 stopTyping();setView(false);root.replaceChildren();window.scrollTo(0,0);
 const map=el('div','world-map');map.setAttribute('aria-label','Карта обители второго блока');
 const heading=el('div','section-heading signs-map-heading');
 heading.append(el('h2','','MOKSHA DHAMA QUEST'),el('p','section-subheading','Раси-таттва · блок 2'));
 const layout=el('div','map-only');layout.append(map);root.append(heading,layout);
 for(const [id,pos] of Object.entries(world.layout)){
  const building=planetBuildings[id];
  const previousRoom=id==='mangala'&&state.taurusUnlocked ? renderMangalaRooms
    : id==='shukra'&&state.geminiUnlocked ? renderShukraRooms
    : id==='budha'&&state.cancerUnlocked ? renderBudhaRooms : null;
  const node=previousRoom
    ? button('',previousRoom,'map-building map-building-open')
    : el('div','map-building');
  node.style.left=pos[0]+'%';node.style.top=pos[1]+'%';node.style.width=id==='surya'?'30%':'24%';
  const img=el('img');img.src='assets/village/buildings/'+building.file+'.png';img.alt=id==='mangala'?world.mangalaBuildingName:id==='chandra'?world.chandraBuildingName:building.name;node.append(img);
  addMapLabel(node,img.alt);
  map.append(node);
 }
 const target=state.cancerUnlocked?'cancer':state.geminiUnlocked?'gemini':state.taurusUnlocked?'taurus':state.indraJoined?'aries':state.testBhriguFinished?'coast':'kailash';
 const markerClass={cancer:' cancer-call',gemini:' gemini-call',taurus:' taurus-call',aries:' aries-call',coast:' coast-call',kailash:''};
 const markerLabel={cancer:world.chandraBuildingName,gemini:planetBuildings.budha.name,taurus:planetBuildings.shukra.name,aries:world.mangalaBuildingName,coast:'Побережье',kailash:'Кайлас'};
 const marker=button('',()=>{
  if(target==='aries')renderMangalaRooms();
  else if(target==='taurus')renderShukraRooms();
  else if(target==='gemini')renderBudhaRooms();
  else if(target==='cancer')renderCancerBaths();
  else renderLocation(target);
 },'kailash-call'+markerClass[target]);
 marker.setAttribute('aria-label',markerLabel[target]);
 addMapLabel(marker,markerLabel[target]);
 marker.disabled=true;
 map.append(marker);
 const enable=()=>{
  if(generation!==revealGeneration||!map.isConnected)return;
  marker.disabled=false;
  marker.classList.add('is-calling');
 };
 if(!reveal){enable();return;}
 map.setAttribute('aria-busy','true');
 const cover=el('img','rashi-cloud-cover');cover.src='assets/village/clouds/cloud-cover.png';cover.alt='';map.append(cover);
 const clouds=el('div','village-clouds');clouds.setAttribute('aria-hidden','true');
 for(const [n,x,y,size]of [[1,22,24,55],[2,74,20,48],[3,50,50,62],[4,20,76,50],[5,78,74,46]]){
  const puff=el('img','village-cloud-puff village-cloud-puff-'+n);
  puff.src='assets/village/clouds/cloud-puff-'+n+'.png';puff.alt='';puff.style.left=x+'%';puff.style.top=y+'%';puff.style.width=size+'%';clouds.append(puff);
 }
 map.append(clouds);
 // Load the actual first-block clouds and all buildings before starting the reveal.
 await Promise.all([...map.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
 if(generation!==revealGeneration||!map.isConnected)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const finish=()=>{if(generation!==revealGeneration||!map.isConnected)return;cover.remove();clouds.remove();map.removeAttribute('aria-busy');enable();};
 if(reduced){finish();return;}
 setTimeout(()=>{
  if(generation!==revealGeneration||!map.isConnected)return;
  cover.classList.add('village-ground-whiteout');
  clouds.classList.add('village-clouds-disperse');
  setTimeout(finish,1800);
 },650);
}
function animateLandscape(scene, kailash) {
  const landscape = scene.querySelector('.location-landscape');
  const teacher = scene.querySelector('.teacher-figure');
  function addLayer(className) {
    const layer = landscape.cloneNode(true);
    layer.classList.add(className);
    layer.setAttribute('aria-hidden', 'true');
    layer.querySelector('img').alt = '';
    scene.insertBefore(layer, teacher);
  }

  addLayer('wind-canopy');
  if (kailash) {
    addLayer('wind-meadow');
    const clouds=el('div','kailash-clouds');
    clouds.setAttribute('aria-hidden','true');
    for(const [index,top,width,duration,delay] of [[1,4,17,49,-16],[2,13,12,65,-42],[3,1,21,80,-63]]){
      const cloud=el('img');
      cloud.src='assets/village/clouds/cloud-puff-'+index+'.png';
      cloud.alt='';
      cloud.style.top=top+'%';
      cloud.style.width=width+'%';
      cloud.style.animationDuration=duration+'s';
      cloud.style.animationDelay=delay+'s';
      clouds.append(cloud);
    }
    scene.insertBefore(clouds,teacher);
  } else {
    addLayer('shore-water');
  }

  const overlay = el('div', 'landscape-motion');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = kailash
    ? '<svg viewBox="0 0 768 432"><g class="mountain-flock"><path d="M0 4l4-3 4 3 4-3 4 3"/><path d="M24 13l3-2 3 2 3-2 3 2"/><path d="M43 3l3-2 3 2 3-2 3 2"/></g></svg>'
    : '<svg viewBox="0 0 768 432"><defs><filter id="coast-ripples" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".008 .035" numOctaves="1" seed="4" result="current"><animate attributeName="baseFrequency" values=".008 .035;.01 .045;.008 .035" dur="6s" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="current" scale="5" xChannelSelector="R" yChannelSelector="G"><animate attributeName="scale" values="2;7;2" dur="4.2s" repeatCount="indefinite"/></feDisplacementMap></filter></defs></svg>';
  scene.insertBefore(overlay, teacher);
}
function renderLocation(id){
 ++revealGeneration;setView(false);stopTyping();root.replaceChildren();window.scrollTo(0,0);
 const kailash=id==='kailash';
 const heading=el('div','page-heading');heading.append(button('← К обители',()=>{state.stage='map';save();renderMap();}),el('p','eyebrow',kailash?'Небесные высоты':'Вселенские воды'),el('h1','',kailash?'Кайлас':'Побережье'));
 const scene=el('section','location-scene '+id);scene.setAttribute('aria-label',kailash?'Место встречи с Бхригу Муни':'Место встречи с Варуной');
 if(kailash){
 const picture=el('picture','location-landscape');
 const source=el('source');source.type='image/webp';source.srcset='assets/signs/locations/kailash-small-display.webp 768w, assets/signs/locations/kailash-display.webp 1280w';source.sizes='(max-width: 850px) calc(100vw - 32px), min(1260px, calc(100vw - 60px))';
 const bg=el('img');bg.src='assets/signs/locations/kailash.png';bg.alt='Снежные вершины Кайласа над каменной площадкой';bg.width=1280;bg.height=720;bg.decoding='async';
 picture.append(source,bg);
 const teacher=el('picture','teacher-figure');const ts=el('source');ts.type='image/webp';ts.srcset='assets/signs/characters/bhrigu-seated.webp';
 const ti=el('img');ti.src='assets/signs/characters/bhrigu-seated.png';ti.alt='Бхригу Муни сидит на фоне Кайласа';ti.width=512;ti.height=512;ti.decoding='async';teacher.append(ts,ti);scene.append(picture,teacher);
 }else{
 const picture=el('picture','location-landscape');
 const source=el('source');source.type='image/webp';source.srcset='assets/signs/locations/coast-small-display.webp 768w, assets/signs/locations/coast-display.webp 1280w';source.sizes='(max-width: 850px) calc(100vw - 32px), min(1260px, calc(100vw - 60px))';
 const bg=el('img');bg.src='assets/signs/locations/coast.png';bg.alt='Бирюзовое мелководье у берега океана';bg.width=1280;bg.height=720;bg.decoding='async';picture.append(source,bg);
 const teacher=el('picture','teacher-figure varuna-figure'),ts=el('source');ts.type='image/webp';ts.srcset='assets/signs/characters/varuna-standing.webp';
 const ti=el('img');ti.src='assets/signs/characters/varuna-standing.png';ti.alt='Варуна стоит в водах океана';ti.width=512;ti.height=768;ti.decoding='async';teacher.append(ts,ti);scene.append(picture,teacher);
 }
 animateLandscape(scene, kailash);
 const copy=el('div','location-conversation');copy.append(el('p','eyebrow',kailash?'Первый урок':'Второй урок'),el('h2','',kailash?'Взгляд с небесных высот':'Знание из глубин'),el('p','',kailash?'В этой локации тебя встретит Бхригу Муни. Он познакомит тебя с устройством небес.':'У океана тебя встречает Варуна — здесь начнётся знакомство с природой и стихиями.'));
 const lines=kailash?world.bhriguIntro:world.varunaIntro;
 let index=-1;
 const speech=el('p','teacher-speech');
 const talk=button(kailash?'Поговорить с Бхригу Муни':'Поговорить с Варуной',()=>{
  if(finishTyping){finishTyping();return;}
  if(index>=lines.length-1){
   stopTyping();++revealGeneration;
   if(kailash){state.testBhriguFinished=true;state.stage='shiva-depths';}
   else{state.testVarunaFinished=true;state.stage='shiva-indra';}
   save();root.replaceChildren();startStory(state.stage);return;
  }
  index++;talk.textContent='Показать весь текст';
  typeText(speech,lines[Math.min(index,lines.length-1)],()=>{
   if(index<lines.length-1)talk.textContent='Далее';
   else talk.textContent='Завершить задания (тест)';
  });
 },'primary');
 copy.append(speech,talk);

 root.append(heading,scene,copy);
 state.stage=id;save();
}
function renderMangalaRooms() {
  stopTyping();
  setView(false);
  root.replaceChildren();
  window.scrollTo(0,0);
  state.stage='mangala';
  save();

  const header=el('div','page-heading');
  header.append(button('← К обители',()=>{
    state.stage='map';
    save();
    renderMap();
  }),el('h1','',world.mangalaBuildingName));

  const ruler=el('div','mangala-ruler');
  const portrait=el('img');
  portrait.src='assets/characters/mangal.png';
  portrait.alt='Мангала';
  ruler.append(portrait,el('p','eyebrow','Мангала'));

  const rooms=el('div','mangala-rooms');
  const aries=button('',renderAriesHall,'mangala-room'+(state.ariesRestored?'':' room-calling'));
  const ariesImage=el('img');
  ariesImage.src='assets/signs/locations/aries-'+(state.ariesRestored?'ready':'unfinished')+'.webp';
  ariesImage.alt='';
  aries.append(ariesImage,el('span','room-sign','Овен'),el('strong','','Зал сражений'));

  const scorpio=button('',()=>{},'mangala-room room-locked');
  scorpio.disabled=true;
  const lockedArt=el('img');
  lockedArt.src='assets/village/buildings/voinskiy-zal.png';
  lockedArt.alt='';
  const lock=el('span','room-lock','🔒');
  lock.setAttribute('aria-hidden','true');
  scorpio.append(lockedArt,lock,el('span','room-sign','Скорпион'),el('strong','','Закрыто'));
  rooms.append(aries,scorpio);
  root.append(header,ruler,rooms);
}
function renderAriesHall() {
  stopTyping();
  setView(false);
  root.replaceChildren();
  window.scrollTo(0,0);
  state.stage='aries';
  save();
  const header=el('div','page-heading');
  header.append(button('← К Мангале',renderMangalaRooms),el('p','eyebrow','Мангала · Овен'),el('h1','','Зал сражений'));
  const scene=el('section','location-scene aries-hall');
  const image=el('img','aries-hall-image');
  image.src='assets/signs/locations/aries-'+(state.ariesRestored?'ready':'unfinished')+'.webp';
  image.alt=state.ariesRestored?'Четыре бойца тренируются в восстановленном зале':'Тёмный недостроенный зал с лесами и горами за проёмами';
  image.width=1280;
  image.height=720;
  scene.append(image);
  const card=el('div','location-conversation');
  if(state.ariesRestored){
    card.append(el('h2','','Зал восстановлен'),el('p','','Защитники обители приступили к тренировкам.'));
    if(!state.taurusUnlocked)card.append(button('Далее',()=>{
      state.stage='indra-taurus';
      save();
      root.replaceChildren();
      startStory('indra-taurus');
    },'primary'));
  }else{
    card.append(el('h2','','Испытания Овна'),button('Завершить задания (тест)',()=>{
      state.ariesRestored=true;
      renderAriesHall();
    },'primary'));
  }
  root.append(header,scene,card);
}
function renderShukraRooms() {
  stopTyping();
  setView(false);
  root.replaceChildren();
  window.scrollTo(0,0);
  state.stage='shukra';
  save();
  const header=el('div','page-heading');
  header.append(button('← К обители',()=>{
    state.stage='map';
    save();
    renderMap();
  }),el('h1','',planetBuildings.shukra.name));

  const ruler=el('div','mangala-ruler');
  const portrait=el('img');
  portrait.src='assets/characters/shukra.png';
  portrait.alt='Шукра';
  ruler.append(portrait,el('p','eyebrow','Шукра'));

  const rooms=el('div','mangala-rooms');
  const taurus=button('',renderTaurusKitchen,'mangala-room'+(state.taurusRestored?'':' room-calling'));
  const kitchenPreview=el('img');
  kitchenPreview.src='assets/signs/locations/taurus-'+(state.taurusRestored?'ready':'ruined')+'.webp';
  kitchenPreview.alt='';
  taurus.append(kitchenPreview,el('span','room-sign','Телец'),el('strong','','Божественная кухня'));
  const libra=button('',()=>{},'mangala-room room-locked');
  libra.disabled=true;
  libra.append(el('span','shukra-room-symbol','♎'),el('span','room-lock','🔒'),el('span','room-sign','Весы'),el('strong','','Закрыто'));
  rooms.append(taurus,libra);
  root.append(header,ruler,rooms);
}
function renderTaurusKitchen() {
  stopTyping();
  setView(false);
  root.replaceChildren();
  window.scrollTo(0,0);
  state.stage='taurus';
  save();
  const header=el('div','page-heading');
  header.append(button('← К Чертогам Шукры',renderShukraRooms),el('p','eyebrow','Шукра · Телец'),el('h1','','Божественная кухня'));
  const scene=el('section','location-scene taurus-kitchen');
  const image=el('img','aries-hall-image');
  image.src='assets/signs/locations/taurus-'+(state.taurusRestored?'ready':'ruined')+'.webp';
  image.alt=state.taurusRestored?'В восстановленной кухне работают повара':'Разрушенная кухня с погасшими очагами';
  image.width=1280;
  image.height=720;
  scene.append(image);
  const card=el('div','location-conversation');
  if(state.taurusRestored){
    card.append(el('h2','','Кухня восстановлена'),el('p','','Повара снова готовят для обители.'));
    if(!state.geminiUnlocked)card.append(button('Далее',()=>{
      state.stage='indra-gemini';
      save();
      root.replaceChildren();
      startStory('indra-gemini');
    },'primary'));
  }else{
    card.append(el('h2','','Испытания Тельца'),button('Завершить задания (тест)',()=>{
      state.taurusRestored=true;
      renderTaurusKitchen();
    },'primary'));
  }
  root.append(header,scene,card);
}
function renderBudhaRooms() {
  stopTyping();
  setView(false);
  root.replaceChildren();
  window.scrollTo(0,0);
  state.stage='budha';
  save();

  const header=el('div','page-heading');
  header.append(button('← К обители',()=>{
    state.stage='map';
    save();
    renderMap();
  }),el('h1','',planetBuildings.budha.name));

  const ruler=el('div','mangala-ruler');
  const portrait=el('img');
  portrait.src='assets/characters/budha.png';
  portrait.alt='Буддха';
  ruler.append(portrait,el('p','eyebrow','Буддха'));

  const rooms=el('div','mangala-rooms');
  const gemini=button('',renderGeminiHall,'mangala-room'+(state.geminiRestored?'':' room-calling'));
  const preview=el('img');
  preview.src='assets/signs/locations/gemini-'+(state.geminiRestored?'ready':'ruined')+'.webp';
  preview.alt='';
  gemini.append(preview,el('span','room-sign','Близнецы'),el('strong','','Зал вестей'));
  const virgo=button('',()=>{},'mangala-room room-locked');
  virgo.disabled=true;
  virgo.append(el('span','shukra-room-symbol','♍'),el('span','room-lock','🔒'),el('span','room-sign','Дева'),el('strong','','Закрыто'));
  rooms.append(gemini,virgo);
  root.append(header,ruler,rooms);
}
function renderGeminiHall() {
  stopTyping();
  setView(false);
  root.replaceChildren();
  window.scrollTo(0,0);
  state.stage='gemini';
  save();
  const header=el('div','page-heading');
  header.append(button('← К Торговой гильдии',renderBudhaRooms),el('p','eyebrow','Буддха · Близнецы'),el('h1','','Зал вестей'));
  const scene=el('section','location-scene gemini-hall');
  const image=el('img','aries-hall-image');
  image.src='assets/signs/locations/gemini-'+(state.geminiRestored?'ready':'ruined')+'.webp';
  image.alt=state.geminiRestored?'В восстановленном зале жители обмениваются вестями':'Заброшенный Зал вестей с разбитой доской объявлений';
  image.width=1280;
  image.height=720;
  scene.append(image);
  const card=el('div','location-conversation');
  if(state.geminiRestored){
    card.append(el('h2','','Зал вестей восстановлен'),el('p','','Жители снова собираются здесь и обмениваются новостями.'));
    if(!state.cancerUnlocked)card.append(button('Далее',()=>{
      state.stage='indra-cancer';
      save();
      root.replaceChildren();
      startStory('indra-cancer');
    },'primary'));
  }else{
    card.append(el('h2','','Испытания Близнецов'),button('Завершить задания (тест)',()=>{
      state.geminiRestored=true;
      renderGeminiHall();
    },'primary'));
  }
  root.append(header,scene,card);
}
function renderCancerBaths() {
  stopTyping();
  setView(false);
  root.replaceChildren();
  window.scrollTo(0,0);
  state.stage='cancer';
  save();

  const header=el('div','page-heading');
  header.append(button('← К обители',()=>{
    state.stage='map';
    save();
    renderMap();
  }),el('p','eyebrow','Чандра · Рак'),el('h1','','Купальни Сомы'));
  root.append(header);
  if(!state.cancerRestored){
    const ruler=el('div','mangala-ruler');
    const portrait=el('img');
    portrait.src='assets/characters/chandra.png';
    portrait.alt='Чандра';
    ruler.append(portrait);
    root.append(ruler);
  }

  const scene=el('section','location-scene cancer-baths');
  const image=el('img','aries-hall-image');
  image.src='assets/signs/locations/cancer-'+(state.cancerRestored?'ready':'ruined')+'.webp';
  image.alt=state.cancerRestored?'Чандра на троне среди цветущих купален':'Разрушенные купальни с пустыми бассейнами и троном';
  image.width=1280;
  image.height=720;
  scene.append(image);

  const card=el('div','location-conversation');
  if(state.cancerRestored){
    card.append(el('h2','','Купальни восстановлены'),el('p','','Тёплая вода вернулась в купели, и Чандра заняла трон.'));
  }else{
    card.append(el('h2','','Испытания Рака'),button('Завершить задания (тест)',()=>{
      state.cancerRestored=true;
      renderCancerBaths();
    },'primary'));
  }
  root.append(scene,card);
}
render();
})();
