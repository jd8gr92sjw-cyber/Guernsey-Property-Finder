const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),script=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
test('market filters both agents, combines with criteria and survives saved searches',async()=>{
 const t=await boot();t.run('resetSearch()');const base={...t.getFeed().properties[0],name:'Market fixture',price:850000,beds:3,parish:'Vale',plot:null,area:null};
 const fixtures=[{...base,id:900002,source:'cooper-brouard',market:'Local Market'},{...base,id:-900002,source:'swoffers',market:'Open Market'}];
 t.setFeed({...t.getFeed(),properties:fixtures});await t.context.loadListings();assert.equal(t.e.count.textContent,'2 matching properties');
 for(const market of ['Local Market','Open Market']){
  t.e.market.value=market;t.run('runSearch()');assert.equal(t.e.count.textContent,'1 matching property');assert.equal(t.run('properties.filter(matches)[0].market'),market);
 }
 t.e.unknown.checked=true;assert.equal(t.run(`matches(${JSON.stringify({...base,market:null})})`),false);
 t.e.parish.value='Castel';t.run('runSearch()');assert.equal(t.e.count.textContent,'0 matching properties');t.e.parish.value='';
 t.e.minPrice.value='900000';t.run('runSearch()');assert.equal(t.e.count.textContent,'0 matching properties');t.e.minPrice.value='800000';
 t.e.market.value='Local Market';t.run('saveSearch();resetSearch()');assert.equal(t.e.market.value,'');t.run('loadSaved()');assert.equal(t.e.market.value,'Local Market');assert.equal(t.e.count.textContent,'1 matching property');assert.match(t.e.savedText.textContent,/Local Market/);
 t.data.set('gp_saved',JSON.stringify({minPrice:'800000'}));t.run('loadSaved()');assert.equal(t.e.market.value,'');assert.equal(t.e.count.textContent,'2 matching properties');
 assert.ok(html.indexOf('for="market"')<html.indexOf('for="minPrice"'));
});
test('floor minimum filters collected totals, labels qualifications and escapes evidence',async()=>{
 const t=await boot();t.run('resetSearch()');t.e.area.value='2500';t.e.unknown.checked=false;
 const p={...t.getFeed().properties[0],area:3000,areaQualifier:'approximate',areaEvidence:[{wording:'Approximately 3000 sqft',unit:'sq ft'}]};
 assert.equal(t.run(`matches(${JSON.stringify(p)})`),true);assert.match(t.run(`card(${JSON.stringify(p)})`),/Approx\. 3,000 sq ft/);
 t.e.area.value='3500';assert.equal(t.run(`matches(${JSON.stringify(p)})`),false);
 t.e.area.value='2500';const bounded={...p,areaQualifier:'upper'};assert.equal(t.run(`matches(${JSON.stringify(bounded)})`),false);
 t.e.unknown.checked=true;assert.equal(t.run(`matches(${JSON.stringify(bounded)})`),true);assert.equal(t.run(`score(${JSON.stringify(bounded)})`),0);
 assert.match(t.run(`card(${JSON.stringify(bounded)})`),/Size unconfirmed: floor area/);
 t.e.area.value='3000';assert.equal(t.run(`matches(${JSON.stringify(bounded)})`),false);
 assert.ok(!t.run(`floorEvidenceHtml(${JSON.stringify({...p,areaEvidence:[{wording:'<script>bad()</script>',unit:'sq m',originalValue:100}]})})`).includes('<script>'));
});
test('duplicate agents use smaller plot before filtering and preserve saved listings',async()=>{
 const t=await boot();const base={...t.getFeed().properties[0],name:'Same House',address:'Test Road',parish:'Vale',market:'Local Market',plot:2,plotQualifier:'exact'};
 const cb={...base,id:900001,source:'cooper-brouard',agent:'Cooper Brouard'},sw={...base,id:-900001,source:'swoffers',agent:'Swoffers',address:'Test Road, Vale',plot:1,url:'https://swoffers.co.uk/property/test'};
 t.setFeed({...t.getFeed(),properties:[cb,sw]});await t.context.loadListings();t.run('resetSearch()');assert.equal(t.e.count.textContent,'1 matching property');assert.equal(t.run('searchProperties()[0].id'),sw.id);
 t.e.plot.value='1.5';t.run('runSearch()');assert.equal(t.e.count.textContent,'0 matching properties');
 t.run('showDetail(-900001)');assert.match(t.e.detail.innerHTML,/Also advertised by/);assert.match(t.e.detail.innerHTML,/Cooper Brouard/);assert.match(t.e.detail.innerHTML,/Swoffers/);
 t.run('toggleShort(900001);currentTab="shortlist";runSearch()');assert.equal(t.e.count.textContent,'1 matching property');assert.match(t.e.results.innerHTML,/Cooper Brouard/);
 for(const different of [{address:'Other Road, Vale'},{parish:'Castel'},{market:'Open Market'},{name:'Other House'},{plot:null},{source:'cooper-brouard'}]){
  t.setFeed({...t.getFeed(),properties:[cb,{...sw,...different}]});await t.context.loadListings();assert.equal(t.run('searchProperties().length'),2);
 }
});
async function boot(initial={}){
 const elements={},data=new Map(Object.entries(initial));
 for(const m of html.matchAll(/<\w+[^>]*id="([^"]+)"[^>]*>/g))elements[m[1]]={value:(m[0].match(/value="([^"]*)"/)||[])[1]||'',checked:/\schecked/.test(m[0]),type:(m[0].match(/type="([^"]*)"/)||[])[1]||'',style:{},classList:{add(){},remove(){}}};elements.beds.value='3';
 let feed=JSON.parse(fs.readFileSync(path.join(__dirname,'properties.json'),'utf8'));let fail=false;
 const context={URL,Date,setTimeout,document:{getElementById:id=>elements[id]||(elements[id]={value:'',style:{}}),querySelectorAll:()=>[],querySelector:()=>({classList:{add(){}}})},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},location:{protocol:'http:'},navigator:{},window:{},fetch:async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>feed}}};vm.createContext(context);vm.runInContext(script,context);await context.loadListings();
 return {run:s=>vm.runInContext(s,context),context,e:elements,data,setFeed:f=>feed=f,getFeed:()=>feed,setFail:v=>fail=v};
}
test('live search, shortlist, saved search and safe note rendering',async()=>{const t=await boot();t.run('resetSearch()');assert.equal(t.e.count.textContent,`${t.getFeed().properties.filter(p=>Number.isFinite(p.price)&&p.price>0).length} matching properties`);t.run('toggleShort(88467);currentTab="shortlist";runSearch()');assert.equal(t.e.count.textContent,'1 matching property');t.e.maxPrice.value='800000';t.run('saveSearch()');t.e.maxPrice.value='1';t.run('loadSaved()');assert.equal(t.e.maxPrice.value,'800000');t.data.set('note_88467','</textarea><script>bad()</script>');t.run('showDetail(88467)');assert.equal(t.e.note_88467.value,t.data.get('note_88467'));assert.ok(!t.e.detail.innerHTML.includes('bad()'))});
test('withdrawn listing remains accessible in shortlist and notes survive refresh failure',async()=>{const t=await boot();t.run('toggleShort(88467)');t.data.set('note_88467','Keep');t.setFeed({...t.getFeed(),properties:t.getFeed().properties.filter(p=>p.id!==88467)});await t.context.loadListings();t.run('currentTab="shortlist";runSearch()');assert.match(t.e.results.innerHTML,/No longer in latest feed/);t.run('showDetail(88467)');assert.equal(t.e.note_88467.value,'Keep');t.setFail(true);assert.equal(await t.context.loadListings(),false);assert.match(t.e.dataStatus.textContent,/Keeping previously loaded/)});
test('legacy Cooper Brouard bookmarks migrate once and removed bookmarks stay removed',async()=>{const t=await boot({gp_shortlist:'[1]',note_1:'Legacy note'});assert.ok(JSON.parse(t.data.get('gp_shortlist')).includes(88467));assert.equal(t.data.get('note_88467'),'Legacy note');t.run('toggleShort(88467)');await t.context.loadListings();assert.ok(!JSON.parse(t.data.get('gp_shortlist')).includes(88467));assert.equal(t.data.get('note_1'),'Legacy note')});
test('corrupt stored JSON does not break startup; source strings are escaped',async()=>{const t=await boot({gp_shortlist:'bad',gp_saved:'bad',gp_property_snapshots:'[]'});assert.ok(t.e.count.textContent);const card=t.run('card({...properties[0],name:"<img src=x onerror=bad()>"})');assert.ok(card.includes('&lt;img'));assert.ok(!card.includes('alt="<img'))});

test('Swoffers properties work in search, shortlist and detail without colliding with Cooper Brouard',async()=>{
 const t=await boot(),p={...t.getFeed().properties[0],id:-32835,name:'Swoffers test',agent:'Swoffers',source:'swoffers',price:360000,url:'https://swoffers.co.uk/property/example',photos:['https://assets.reapit.net/swf/live/pictures/example.jpg']};
 t.setFeed({...t.getFeed(),agent:'Cooper Brouard and Swoffers',properties:[...t.getFeed().properties.filter(existing=>existing.id!==p.id),p]});await t.context.loadListings();t.run('resetSearch();toggleShort(-32835);toggleShort(88467);currentTab="shortlist";runSearch()');
 assert.equal(t.e.count.textContent,'2 matching properties');t.run('showDetail(-32835)');assert.match(t.e.detail.innerHTML,/Source: Swoffers/);assert.match(t.e.detail.innerHTML,/assets.reapit.net/);assert.match(t.e.detail.innerHTML,/https:\/\/swoffers.co.uk\/property\/example/);
 t.e['note_-32835'].value='Swoffers note';t.run('saveNote(-32835)');assert.equal(t.data.get('note_-32835'),'Swoffers note');assert.notEqual(t.data.get('note_88467'),'Swoffers note');
 assert.match(t.e.dataStatus.textContent,/Cooper Brouard and Swoffers/);
});
test('old cached feeds cannot reintroduce unpriced search results',async()=>{
 const t=await boot();t.setFeed({...t.getFeed(),properties:[...t.getFeed().properties,{...t.getFeed().properties[0],id:999999,price:null}]});await t.context.loadListings();t.run('resetSearch()');assert.equal(t.run('properties.some(p=>p.price===null)'),false);
});

test('unknown features remain possible matches, while explicit failures are excluded',async()=>{
 const t=await boot();t.e.unknown.checked=false;
 const p={price:850000,beds:3,type:'House',parish:'Vale',status:'sale',plot:null,area:null,parking:null,south:null,garden:null,refurb:null,development:null};
 for(const k of ['parking','south','garden','refurb','development'])t.e[k].checked=true;
 const matches=p=>t.run(`matches(${JSON.stringify(p)})`);
 assert.equal(matches(p),true);
 for(const k of ['south','garden','refurb','development']){
  assert.equal(matches({...p,[k]:false}),false,k+' explicitly absent');
  assert.equal(matches({...p,[k]:true}),true,k+' confirmed');
  const missing={...p};delete missing[k];assert.equal(matches(missing),true,k+' not supplied');
 }
 for(const [k,min] of [['plot',.5],['area',1500],['parking',3]]){
  if(k!=='parking')t.e[k].value=String(min);
  assert.equal(matches(p),k==='parking',k+' unknown size');
  assert.equal(matches({...p,[k]:0}),false,k+' known zero');
  assert.equal(matches({...p,[k]:min-.1}),false,k+' below minimum');
  assert.equal(matches({...p,[k]:min}),true,k+' at minimum');
  if(k!=='parking')t.e[k].value='';
 }
 assert.equal(matches({...p,beds:2}),false);
 assert.equal(matches({...p,beds:null}),false);
 t.e.type.value='House';assert.equal(matches({...p,type:null}),false);
 t.e.unknown.checked=true;
 assert.equal(matches({...p,beds:null,type:null}),true);
 assert.equal(matches({...p,south:false}),false);
 assert.equal(matches({...p,price:900000}),false);
 assert.equal(matches({...p,type:'Apartment'}),false);
 t.e.parish.value='Castel';assert.equal(matches(p),false);
 t.e.parish.value='';t.e.status.value='under';assert.equal(matches(p),false);
 t.e.status.value='';assert.equal(matches({...p,unavailable:true}),false);
 assert.match(t.run(`card(${JSON.stringify({...t.getFeed().properties[0],...p})})`),/badge unknown/);
});

test('default search with unknown bedrooms disabled retains listings from both agents',async()=>{
 const t=await boot();
 // Fixed fixtures keep future collections from failing when the market changes.
 const featureUnknowns={price:850000,beds:3,plot:null,area:null,parking:null,south:null,garden:null,refurb:null,development:null};
 const fixtures=['cooper-brouard','swoffers'].map(source=>({...t.getFeed().properties.find(p=>p.source===source),...featureUnknowns}));
 t.setFeed({...t.getFeed(),properties:fixtures});await t.context.loadListings();
 t.e.unknown.checked=false;t.run('runSearch()');
 const matches=t.run('properties.filter(matches)');assert.ok(matches.length>0);
 assert.ok(matches.some(p=>p.source==='cooper-brouard'));
 assert.ok(matches.some(p=>p.source==='swoffers'));
 assert.ok(matches.every(p=>p.price>=800000&&p.price<=895000&&p.beds>=3));
 t.run('saveSearch()');t.e.unknown.checked=true;t.run('loadSaved()');assert.equal(t.e.unknown.checked,false);
 assert.equal(t.e.count.textContent,`${matches.length} matching properties`);
});

test('New today uses Guernsey calendar dates, rejects missing dates and preserves saved searches',async()=>{
 const t=await boot(),now=Date.parse('2026-10-01T11:00:00Z');
 t.context.Date=class extends Date {static now(){return now}};
 const today=date=>t.run(`isNewToday({date:${JSON.stringify(date)}})`);
 assert.equal(today('2026-10-01'),true);
 assert.equal(today('2026-09-30T23:30:00Z'),true); // 00:30 in Guernsey.
 assert.equal(today('2026-09-30T22:30:00Z'),false);
 assert.equal(today('2026-10-02'),false);
 assert.equal(today('2026-10-01T13:00:00Z'),false);
 for(const date of [null,'','invalid','2026-02-30'])assert.equal(today(date),false);
 assert.equal(t.run(`isNewToday({date:'2026-10-25T00:30:00Z'},Date.parse('2026-10-25T12:00:00Z'))`),true);
 assert.equal(t.run(`isNewToday({date:'2026-12-31T23:30:00Z'},Date.parse('2027-01-01T12:00:00Z'))`),false);
 t.run('resetSearch()');t.e.newToday.checked=true;
 const p={...t.getFeed().properties[0],price:850000,date:'2026-10-01'};
 assert.equal(t.run(`matches(${JSON.stringify(p)})`),true);
 assert.equal(t.run(`matches(${JSON.stringify({...p,date:'2026-09-30'})})`),false);
 t.e.maxPrice.value='800000';assert.equal(t.run(`matches(${JSON.stringify(p)})`),false);
 t.run('saveSearch()');t.e.newToday.checked=false;t.run('loadSaved()');assert.equal(t.e.newToday.checked,true);
 t.run('resetSearch()');assert.equal(t.e.newToday.checked,false);
 t.data.set('gp_saved',JSON.stringify({minPrice:'800000'}));t.run('loadSaved()');assert.equal(t.e.newToday.checked,false);
});

test('size minima exclude undersized listings and include unknowns only when enabled',async()=>{
 const t=await boot();t.run('resetSearch()');
 const p={...t.getFeed().properties[0],plot:50,area:50000};
 t.e.plot.value='50';t.e.area.value='50000';
 const matches=p=>t.run(`matches(${JSON.stringify(p)})`);
 for(const unknown of [true,false]){
  t.e.unknown.checked=unknown;
  assert.equal(matches(p),true);
  for(const k of ['plot','area']){
   assert.equal(matches({...p,[k]:null}),unknown);
   const missing={...p};delete missing[k];assert.equal(matches(missing),unknown);
   assert.equal(matches({...p,[k]:p[k]-1}),false);
  }
 }
 t.e.plot.value='';assert.equal(matches({...p,plot:null}),true);
 t.e.area.value='';assert.equal(matches({...p,plot:null,area:null}),true);
 t.e.plot.value='50';t.e.area.value='50000';t.run('saveSearch();resetSearch();loadSaved()');
 assert.equal(t.e.plot.value,'50');assert.equal(t.e.area.value,'50000');
 assert.equal(matches({...p,plot:null,area:null}),false);
});

test('plot bounds and approximation remain visible and cannot create false minimum matches',async()=>{
 const t=await boot();t.run('resetSearch()');t.e.unknown.checked=false;t.e.plot.value='.5';
 const base={...t.getFeed().properties[0],plot:.5,plotEvidence:[{wording:'A plot of around half an acre.'}]};
 for(const qualifier of ['exact','approximate','lower'])assert.equal(t.run(`matches(${JSON.stringify({...base,plotQualifier:qualifier})})`),true);
 assert.equal(t.run(`matches(${JSON.stringify({...base,plotQualifier:'upper'})})`),false);
 assert.equal(t.run(`matches(${JSON.stringify({...base,plot:null,plotQualifier:'unconfirmed'})})`),false);
 t.e.plot.value='.6';assert.equal(t.run(`matches(${JSON.stringify({...base,plotQualifier:'lower'})})`),false);
 assert.match(t.run(`card(${JSON.stringify({...base,plotQualifier:'approximate'})})`),/Approx\. 0\.5 acres/);
 assert.match(t.run(`card(${JSON.stringify({...base,plotQualifier:'upper'})})`),/Under 0\.5 acres/);
 assert.match(t.run(`card(${JSON.stringify({...base,plot:null})})`),/Plot total unconfirmed/);
 assert.ok(!t.run(`plotEvidenceHtml(${JSON.stringify({...base,plotEvidence:[{wording:'<script>bad()</script>'}]})})`).includes('<script>'));
});

test('small size minima retain possibilities, label missing sizes and save the unknown setting',async()=>{
 const t=await boot();const base={...t.getFeed().properties[0],plot:null,area:null,price:850000};
 t.setFeed({...t.getFeed(),properties:[base]});await t.context.loadListings();t.run('resetSearch()');t.e.plot.value='.1';t.e.area.value='10';t.run('runSearch()');
 assert.equal(t.e.count.textContent,'1 matching property · 1 with size unconfirmed');
 assert.match(t.e.results.innerHTML,/Size unconfirmed: plot and floor area minimum not verified/);
 assert.equal(t.run(`score(${JSON.stringify(base)})`),0);
 t.run('saveSearch()');t.e.unknown.checked=false;t.run('runSearch()');assert.equal(t.e.count.textContent,'0 matching properties');
 t.run('loadSaved()');assert.equal(t.e.unknown.checked,true);assert.match(t.e.count.textContent,/1 matching property/);
 const bounded={...base,plot:.5,plotQualifier:'upper'};
 assert.equal(t.run(`matches(${JSON.stringify(bounded)})`),true);
 assert.match(t.run(`card(${JSON.stringify(bounded)})`),/Size unconfirmed: plot and floor area/);
 t.e.plot.value='.5';assert.equal(t.run(`matches(${JSON.stringify(bounded)})`),false);
 t.e.plot.value='.6';assert.equal(t.run(`matches(${JSON.stringify(bounded)})`),false);
 t.e.plot.value='.1';t.e.unknown.checked=false;assert.equal(t.run(`matches(${JSON.stringify({...base,plot:.5,area:100})})`),true);
 assert.equal(t.run(`matches(${JSON.stringify({...base,plot:.05,area:100})})`),false);
});
