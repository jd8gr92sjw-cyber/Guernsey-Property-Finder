'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids=['market','minPrice','maxPrice','beds','type','plot','area','parish','status','parking','south','garden','refurb','development','unknown','newToday'];
const storage={getItem(key){try{return localStorage.getItem(key)}catch{return null}},setItem(key,value){try{localStorage.setItem(key,value);return true}catch{notify('Unable to save on this device. Check browser storage permissions.');return false}},removeItem(key){try{localStorage.removeItem(key);return true}catch{notify('Unable to delete saved data.');return false}}};
function notify(message){$('actionStatus').textContent=message}
function readJSON(key,fallback){try{return JSON.parse(storage.getItem(key))??fallback}catch{return fallback}}
function savedCriteria(){const o=readJSON('gp_saved',null);return o&&typeof o==='object'&&!Array.isArray(o)?o:null}
let properties=[],currentTab='search',currentDetail=null,dataset=null,loading=true;
let shortlist=readJSON('gp_shortlist',[]);if(!Array.isArray(shortlist))shortlist=[];
const val=id=>$(id).value,checked=id=>$(id).checked;
const money=p=>p.price==null?'Price on application':'£'+p.price.toLocaleString('en-GB');
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['www.cooperbrouard.com','cdn.cooperbrouard.com','swoffers.co.uk','assets.reapit.net'].includes(u.hostname)?u.href:''}catch{return ''}};
function statusLabel(p){return p.unavailable?'No longer in latest feed':p.status==='under'?'Under offer':'For sale'}
function isNew(p){return p.date&&Date.now()-Date.parse(p.date)>=0&&Date.now()-Date.parse(p.date)<=14*86400000}
function plotLabel(p){
 if(p.plot==null)return p.plotEvidence?.length?'Plot total unconfirmed':'Plot unknown';
 const prefix={approximate:'Approx. ',lower:p.plotModifier==='at least'?'At least ':'Over ',upper:/^(up to|at most)$/.test(p.plotModifier||'')?'Up to ':'Under '}[p.plotQualifier]||'';
 return prefix+p.plot+' acre'+(p.plot===1?'':'s')+(p.plotConflict?' (smaller conflicting figure)':'');
}
function floorLabel(p){
 if(p.area==null)return 'Floor area unknown';
 const prefix={approximate:'Approx. ',lower:p.areaModifier==='at least'?'At least ':'Over ',upper:/^(up to|at most)$/.test(p.areaModifier||'')?'Up to ':'Under '}[p.areaQualifier]||'';
 return prefix+p.area.toLocaleString('en-GB',{maximumFractionDigits:1})+' sq ft'+(p.areaConflict?' (smaller conflicting figure)':'');
}
function floorEvidenceHtml(p){return p.areaEvidence?.length?`<h3>Agent's floor-area wording</h3>${p.areaConflict?'<p class="source-note">Advertised totals conflict; the smaller figure is used.</p>':''}<ul>${p.areaEvidence.map(e=>`<li>${esc(e.wording)}${e.unit==='sq m'?' (Agent states '+esc(e.originalValue)+' sq m; converted to sq ft.)':''}</li>`).join('')}</ul><p class="source-note">Only stated floor-area totals are collected. Room dimensions, terraces and separate outbuildings are not added together. Approximate and bounded figures retain their qualifications.</p>`:''}
function plotEvidenceHtml(p){return p.plotEvidence?.length?`<h3>Agent's plot-size wording</h3>${p.plotConflict?'<p class="source-note">Advertised figures conflict. The smaller figure is shown, retaining the stricter qualification when the figures are equal.</p>':''}<ul>${p.plotEvidence.map(e=>`<li>${esc(e.wording)}</li>`).join('')}</ul><p class="source-note">Separate parcels have not been added into a total. Approximate and bounded measurements retain the agent's qualifications.</p>`:''}
const localListingDay=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Guernsey',year:'numeric',month:'2-digit',day:'2-digit'});
function isNewToday(p,now=Date.now()){
 if(typeof p.date!=='string'||!p.date.trim())return false;
 const date=new Date(p.date);if(!Number.isFinite(date.getTime()))return false;
 // A date without a time is the agent's calendar date, not a collection timestamp.
 if(/^\d{4}-\d{2}-\d{2}$/.test(p.date))return date.toISOString().slice(0,10)===p.date&&localListingDay.format(date)===localListingDay.format(new Date(now));
 return date.getTime()<=now&&localListingDay.format(date)===localListingDay.format(new Date(now));
}
function sizeState(p,k){
 const minimum=Number(val(k));if(!(minimum>0))return 'pass';
 if(p[k]==null)return 'unknown';
 if(p[k]<minimum)return 'fail';
 const qualifier=k==='plot'?p.plotQualifier:p.areaQualifier,modifier=k==='plot'?p.plotModifier:p.areaModifier;
 if(qualifier==='upper'){
  if(p[k]===minimum&&!/^(up to|at most)$/.test(modifier||''))return 'fail';
  return 'unknown';
 }
 return 'pass';
}
function unconfirmedSizes(p){return ['plot','area'].filter(k=>sizeState(p,k)==='unknown').map(k=>k==='plot'?'plot':'floor area')}
function sizeNotice(p){const sizes=unconfirmedSizes(p);return currentTab==='search'&&sizes.length?`<p class="source-note">Size unconfirmed: ${sizes.join(' and ')} minimum not verified.</p>`:''}
function matches(p){
 if(p.unavailable)return false;
 if(val('market')&&p.market!==val('market'))return false;
 if(checked('newToday')&&!isNewToday(p))return false;
 const min=Number(val('minPrice'))||0,max=val('maxPrice')===''?Infinity:Number(val('maxPrice'));
 if(p.price==null){if((min||max!==Infinity)&&!checked('unknown'))return false}else if(p.price<min||p.price>max)return false;
 if(Number(val('beds'))>0&&(p.beds==null?!checked('unknown'):p.beds<Number(val('beds'))))return false;
 for(const k of ['plot','area']){const state=sizeState(p,k);if(state==='fail'||state==='unknown'&&!checked('unknown'))return false;}
 if(val('type')&&(p.type==null?!checked('unknown'):p.type!==val('type')))return false;
 if(val('parish')&&p.parish!==val('parish'))return false;
 if(checked('parking')&&p.parking!=null&&p.parking<3)return false;
 for(const k of ['south','garden','refurb','development'])if(checked(k)&&p[k]===false)return false;
 if(val('status')==='new'&&!isNew(p))return false;
 if(val('status')&&val('status')!=='new'&&p.status!==val('status'))return false;
 return true;
}
function score(p){const tests=[];for(const k of ['beds','plot','area'])if(+val(k)>0)tests.push(sizeState(p,k)==='pass');if(checked('parking'))tests.push(p.parking!=null&&p.parking>=3);for(const k of ['south','garden','refurb','development'])if(checked(k))tests.push(p[k]===true);return tests.length?Math.round(tests.filter(Boolean).length/tests.length*100):null}
function card(p){
 const saved=shortlist.includes(p.id),sc=score(p),photo=safeUrl(p.photos?.[0]);
 const badge=(label,v)=>`<span class="badge ${v==null?'unknown':v?'yes':''}">${v==null?'?':v?'✓':'✕'} ${label}</span>`;
 return `<article class="card"><div class="photo">${photo?`<img src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.textContent='Photo unavailable'">`:'No photograph supplied'}</div><div class="body"><div class="top"><div class="price">${money(p)}</div><div class="tag">${esc(p.agent)}</div></div><div class="name">${esc(p.name)}</div><div class="meta">${esc(p.type||'Type unknown')} · ${esc(p.location)} · ${esc(p.market)}</div><p class="source-note">${statusLabel(p)}${isNew(p)?' · Listed within 14 days':''}</p><div class="facts">${p.beds??'Unknown'} beds · ${esc(plotLabel(p))} · ${esc(floorLabel(p))}</div>${sizeNotice(p)}<div class="badges">${badge('3+ parking',p.parking==null?null:p.parking>=3)}${badge('South/sunny',p.south)}${badge('Outside space',p.garden)}${badge('Refurb potential',p.refurb)}</div><div class="footer"><span class="match">${sc==null?'No feature preferences':sc+'% confirmed feature match'}</span><div class="actions2"><button class="icon" aria-label="${saved?'Remove from':'Add to'} shortlist: ${esc(p.name)}" aria-pressed="${saved}" onclick="toggleShort(${p.id})">${saved?'⭐':'☆'}</button><button class="icon" onclick="showDetail(${p.id})">Details</button></div></div></div></article>`;
}
function allProperties(){const saved=readJSON('gp_property_snapshots',{});const snapshots=saved&&typeof saved==='object'&&!Array.isArray(saved)?Object.values(saved):[];return [...properties,...snapshots.filter(p=>p&&Number.isInteger(p.id)&&shortlist.includes(p.id)&&!properties.some(q=>q.id===p.id)).map(p=>({...p,unavailable:true}))]}
function searchProperties(){
 const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const groups=new Map();
 for(const p of properties){
  const road=normal(String(p.address||'').split(',').filter(part=>normal(part)!==normal(p.parish)).join(','));
  // Require a specific name and matching street, parish and market. Ambiguous listings stay separate.
  const key=road&&p.parish&&p.market&&p.name&&!/confidential|investment opportunity/i.test(p.name)?[normal(p.name),road,normal(p.parish),normal(p.market)].join('|'):'id:'+p.id;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
 }
 return [...groups.values()].flatMap(group=>{
  if(group.length!==2||group[0].source===group[1].source||group.some(p=>!Number.isFinite(p.plot)||p.plot<=0))return group;
  const priority={upper:0,approximate:1,exact:2,lower:3};
  const sorted=[...group].sort((a,b)=>a.plot-b.plot||(priority[a.plotQualifier]??2)-(priority[b.plotQualifier]??2));
  return [{...sorted[0],duplicateListings:group}];
 });
}
function duplicateEvidenceHtml(p){return p.duplicateListings?`<h3>Also advertised by</h3><p class="source-note">One search result is shown using the smaller advertised plot figure. Both original listings remain available.</p><ul>${p.duplicateListings.map(q=>`<li><a href="${esc(safeUrl(q.url))}" target="_blank" rel="noopener noreferrer">${esc(q.agent)}</a>: ${esc(plotLabel(q))}</li>`).join('')}</ul>`:''}
function runSearch(){
 const r=currentTab==='shortlist'?allProperties().filter(p=>shortlist.includes(p.id)):searchProperties().filter(matches);
 const newest=(a,b)=>(b.date||'').localeCompare(a.date||'')||(a.price??Infinity)-(b.price??Infinity);
 r.sort(val('sort')==='price-desc'?(a,b)=>(b.price??-Infinity)-(a.price??-Infinity)||newest(a,b):val('sort')==='price-asc'?(a,b)=>(a.price??Infinity)-(b.price??Infinity)||newest(a,b):newest);
 const uncertain=currentTab==='search'?r.filter(p=>unconfirmedSizes(p).length).length:0;
 $('count').textContent=`${r.length} matching ${r.length===1?'property':'properties'}${uncertain?' · '+uncertain+' with size unconfirmed':''}`;
 $('results').innerHTML=r.length?r.map(card).join(''):`<div class="empty">${loading?'Loading listings…':currentTab==='shortlist'?'Your shortlist is empty.':!properties.length?'No listing data is available. Connect to the internet and refresh.':'No properties match. Try widening your search or leaving size minimums blank.'}</div>`;
}
function remember(p){let saved=readJSON('gp_property_snapshots',{});if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};saved[p.id]=p;storage.setItem('gp_property_snapshots',JSON.stringify(saved))}
function toggleShort(id){const next=shortlist.includes(id)?shortlist.filter(x=>x!==id):[...shortlist,id];if(storage.setItem('gp_shortlist',JSON.stringify(next))){shortlist=next;const p=allProperties().find(p=>p.id===id);if(p)remember(p);runSearch()}}
function showDetail(id){
 const p=(currentTab==='search'?searchProperties():allProperties()).find(p=>p.id===id)||allProperties().find(p=>p.id===id);if(!p)return;currentDetail=id;remember(p);
 $('listPanel').style.display='none';$('searchPanel').style.display='none';$('detail').className='detail show';
 const photos=(p.photos||[]).map(safeUrl).filter(Boolean);
 $('detail').innerHTML=`<button class="btn secondary back" onclick="hideDetail()">← Back to results</button><div class="panel"><div class="gallery">${photos.length?photos.map((url,i)=>`<img src="${esc(url)}" alt="${esc(p.name)} — photo ${i+1}" loading="lazy" referrerpolicy="no-referrer" onerror="this.alt='Photo unavailable';this.style.display='none'">`).join(''):'No photographs supplied'}</div><h2>${esc(p.name)}</h2><div class="price">${money(p)}</div><p>${statusLabel(p)} · ${esc(p.market)}</p><p class="meta">${esc(p.type||'Type unknown')} · ${esc(p.address)} · ${esc(p.location)} · ${esc(p.agent)}</p><div class="two"><div><h3>Key facts</h3><ul><li>Bedrooms: ${p.beds??'Unknown'}</li><li>Plot: ${esc(plotLabel(p))}</li><li>Floor area: ${esc(floorLabel(p))}</li><li>Parking spaces: ${p.parking??'Unknown'}</li></ul></div><div><h3>Things to investigate</h3><ul><li>Aspect: ${p.south==null?'Unknown':p.south?'South / sunny':'Other'}</li><li>Refurbishment potential: ${p.refurb==null?'Unknown':p.refurb?'Flagged':'Not flagged'}</li><li>Development potential: ${p.development==null?'Unknown':p.development?'Flagged':'Not flagged'}</li></ul></div></div>${sizeNotice(p)}${duplicateEvidenceHtml(p)}${plotEvidenceHtml(p)}${floorEvidenceHtml(p)}<h3>Agent description</h3><p class="description">${esc(p.description||'No description supplied.')}</p><p class="source-note">Source: ${esc(p.agent)}. Last collected ${esc(new Date(p.lastSeen).toLocaleString())}. Photographs require a connection and may be unavailable offline. Missing facts have not been inferred from photographs or marketing text.</p><h3><label for="note_${p.id}">Your notes</label></h3><textarea id="note_${p.id}" placeholder="Add your own notes..."></textarea><div class="actions"><button class="btn primary" onclick="saveNote(${p.id})">Save note</button>${safeUrl(p.url)?`<a class="btn secondary" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">Open original listing ↗</a>`:''}</div></div>`;
 $('note_'+id).value=storage.getItem('note_'+id)||'';
}
function saveNote(id){if(storage.setItem('note_'+id,$('note_'+id).value))notify('Note saved on this device.')}
function hideDetail(){currentDetail=null;$('detail').className='detail';$('searchPanel').style.display=currentTab==='saved'?'none':'block';$('listPanel').style.display='block';runSearch()}
function setTab(t,el){currentTab=t;currentDetail=null;$('detail').className='detail';$('listPanel').style.display=t==='saved'?'none':'block';document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));el.classList.add('active');$('searchPanel').style.display=t==='saved'?'none':'block';$('savedPanel').style.display=t==='saved'?'block':'none';runSearch();updateSaved()}
function saveSearch(){const o={};ids.forEach(id=>o[id]=$(id).type==='checkbox'?checked(id):val(id));if(storage.setItem('gp_saved',JSON.stringify(o)))notify('Search saved on this device.')}
function loadSaved(){const o=savedCriteria();if(!o)return;if(!('market' in o))$('market').value='';ids.forEach(id=>{if(!(id in o))return;if($(id).type==='checkbox')$(id).checked=o[id]===true;else if(['string','number'].includes(typeof o[id]))$(id).value=o[id]});setTab('search',document.querySelector('.tab'))}
function deleteSaved(){if(storage.removeItem('gp_saved'))updateSaved()}
function updateSaved(){const o=savedCriteria();$('savedText').textContent=o?`Saved criteria: ${o.market||'Both markets'}, £${o.minPrice||'any'}–£${o.maxPrice||'any'}, ${o.beds||'any'}+ beds, ${o.type||'any type'}, ${o.parish||'any parish'}, ${o.plot||'any'}+ acre plot.`:'No saved search yet.'}
function resetSearch(){ids.forEach(id=>{if($(id).type==='checkbox')$(id).checked=id==='unknown';else $(id).value=''});runSearch()}
function validateData(data){return data?.schemaVersion===1&&Array.isArray(data.properties)&&data.properties.length>0&&data.properties.every(p=>Number.isInteger(p.id)&&typeof p.name==='string'&&safeUrl(p.url)&&Array.isArray(p.photos)&&(p.price===null||Number.isFinite(p.price)))}
function migrateDemo(){
 if(storage.getItem('gp_live_migrated')==='1')return;
 // Only map known Cooper Brouard demo records by exact name; preserve all old keys.
 const names={1:'Vue Des Etoiles',5:'Gallifrey',6:'Les Houards de Bas'};let changed=false;
 for(const [oldId,name] of Object.entries(names)){const p=properties.find(p=>p.name.toLowerCase()===name.toLowerCase());if(!p)continue;if(shortlist.includes(Number(oldId))&&!shortlist.includes(p.id)){shortlist.push(p.id);remember(p);changed=true}const note=storage.getItem('note_'+oldId);if(note&&!storage.getItem('note_'+p.id))storage.setItem('note_'+p.id,note)}
 if(changed&&!storage.setItem('gp_shortlist',JSON.stringify(shortlist)))return;
 storage.setItem('gp_live_migrated','1');
}
async function loadListings(){
 try{const r=await fetch('./properties.json',{cache:'no-store'});if(!r.ok)throw Error('Listing feed unavailable');const data=await r.json();if(!validateData(data))throw Error('Invalid listing feed');dataset=data;properties=data.properties.filter(p=>Number.isFinite(p.price)&&p.price>0);loading=false;
  const age=Date.now()-Date.parse(data.generatedAt);$('dataStatus').textContent=`${properties.length} ${data.agent||'property'} listings · Collected ${new Date(data.generatedAt).toLocaleString()}${age>86400000?' · Data is over 24 hours old; refresh when online.':''}`;
  const typeValue=val('type');const types=[...new Set(['Bungalow','Chalet bungalow','House','Cottage','Apartment',...properties.map(p=>p.type).filter(Boolean)])].sort();$('type').innerHTML='<option value="">Any</option>'+types.map(t=>`<option>${esc(t)}</option>`).join('');$('type').value=typeValue;
  migrateDemo();runSearch();return true;
 }catch(error){loading=false;$('dataStatus').textContent=properties.length?'Refresh failed. Keeping previously loaded listings.':'Unable to load listings. Start the collector or reconnect and reload.';runSearch();return false}
}
async function refreshListings(){
 const button=$('refreshData');button.disabled=true;notify('Checking for the latest published listings…');
 try{const loaded=await loadListings();if(loaded)notify('Latest published listings loaded. The cloud collector runs every six hours.');else notify('Could not load an updated feed. Previously loaded listings are retained.');}
 finally{button.disabled=false}
}
updateSaved();runSearch();loadListings();
if(location.protocol==='file:')$('appStatus').textContent='Open this app through localhost or HTTPS; see README.';
else if('serviceWorker' in navigator&&window.isSecureContext){window.addEventListener('load',async()=>{try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('appStatus').textContent='App and last published listings available offline; photographs need a connection.'}catch{$('appStatus').textContent='Offline setup failed. Reconnect and reload to retry.'}})}
