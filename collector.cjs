const fs = require('node:fs/promises');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');
const ORIGIN = 'https://www.cooperbrouard.com';
const SWOFFERS = 'https://swoffers.co.uk';
const DATA = path.join(__dirname, 'properties.json');
const UA = 'GuernseyPropertyFinder/1.0 (private property search; low-frequency collector)';
// Only explicitly advertised positive GBP asking prices qualify. A hidden
// structured-data number must never override a POA/request label.
function askingPrice(label, value) {
  const visible=text(label);
  if(/\bP\s*\.?\s*O\s*\.?\s*[AR]\b|price\s+(?:on|upon)\s+(?:application|request)|\b(?:application|request)\b/i.test(visible))return null;
  const match=visible.match(/(?:£|GBP\s*)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?(?![\w,.])/i);
  if(!match)return null;
  const price=Number(match[1].replaceAll(',','')+(match[2]?'.'+match[2]:''));
  if(!Number.isFinite(price)||price<=0)return null;
  if(value!==undefined&&value!==null&&String(value).trim()!==''&&Number(value)!==price)throw Error('Advertised and structured asking prices disagree');
  return price;
}
function text(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|pound|rsquo|lsquo|ndash|mdash);/gi, (_, e) => {
    if(e[0]==='#')return String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1)));
    return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',pound:'£',rsquo:"'",lsquo:"'",ndash:'–',mdash:'—'}[e.toLowerCase()];
  }).replace(/\s+/g,' ').trim();
}
function advertisedPlot(...sources){
  const words={half:.5,quarter:.25,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  const evidence=[];
  const pattern=/\b(?:(just\s+under|just\s+over|approximately|approx\.?|around|about|circa|close to|nearly|almost|in excess of|more than|less than|at least|at most|over|under|up to)\s+)?(?:a\s+)?((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+and\s+a\s+(?:half|quarter)|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s+of)?(?:\s+an?)?[\s-]+acres?\b/gi;
  for(const source of sources){
    const description=text(source);
    for(const m of description.matchAll(pattern)){
      const before=description.slice(Math.max(0,m.index-100),m.index),after=description.slice(m.index+m[0].length,m.index+m[0].length+70);
      const context=before+m[0]+after;
      if(!/\b(?:plot|site|gardens?|grounds?|land|field|set|sitting|situated)\b/i.test(context))continue;
      if(/\b(?:nearby|neighbour(?:ing)?|overlooking|views? (?:over|across)|option to purchase|available separately)\b/i.test(context))continue;
      const mixed=m[2].toLowerCase().split(/\s+and\s+a\s+/);
      const amount=mixed.length===2?(words[mixed[0]]??Number(mixed[0]))+words[mixed[1]]:words[m[2].toLowerCase()]??Number(m[2].replaceAll(',',''));
      if(!Number.isFinite(amount)||amount<=0)continue;
      const modifier=(m[1]||'').toLowerCase();
      const qualifier=/under|less than|up to|at most|nearly|almost/.test(modifier)?'upper':/over|more than|in excess|at least/.test(modifier)?'lower':modifier?'approximate':'exact';
      const range=/(?:\d|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:[-–—/]|to|and)\s*$/i.test(before)||/\bbetween\s+[^.!?]{0,30}$/i.test(before)||/[.,−-]\s*$/.test(before);
      const partial=/\b(?:additional|further|separate)\s+(?:[\w.]+\s+){0,6}(?:land|field|parcel|acres?)\b/i.test(context)||/\bagricultural\s+(?:field|land)\b/i.test(context)||/\bplus\s+(?:a\s+)?(?:field|parcel|land|garden)\b/i.test(context);
      const quote=context.trim();
      if(!evidence.some(e=>e.value===amount&&e.qualifier===qualifier&&e.modifier===modifier&&e.partial===partial&&e.range===range))evidence.push({value:amount,qualifier,modifier,partial,range,wording:quote});
    }
  }
  if(!evidence.length)return {plot:null};
  // Never add separate parcels or turn a range into an invented total.
  const distinct=new Set(evidence.map(e=>e.value+':'+e.qualifier));
  if(evidence.some(e=>e.partial||e.range))return {plot:null,plotQualifier:'unconfirmed',plotEvidence:evidence};
  const smallest=Math.min(...evidence.map(e=>e.value));
  const priority={upper:0,approximate:1,exact:2,lower:3};
  const chosen=evidence.filter(e=>e.value===smallest).sort((a,b)=>priority[a.qualifier]-priority[b.qualifier])[0];
  return {plot:chosen.value,plotQualifier:chosen.qualifier,plotModifier:chosen.modifier,plotConflict:distinct.size>1,plotEvidence:evidence};
}
function advertisedFloor(...sources){
 const evidence=[];
 const pattern=/\b(?:(approximately|approx\.?|around|about|circa|nearly|almost|in excess of|more than|less than|at least|at most|over|under|up to)\s+)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(sq\.?\s*ft\.?|sq\.?\s*feet|square\s+feet|ft[²2]|sq\.?\s*m(?:et(?:re|er)s?)?\.?|square\s+met(?:re|er)s|m[²2])(?!\w)/gi;
 for(const source of sources){
  const description=text(source);
  for(const m of description.matchAll(pattern)){
   const before=description.slice(Math.max(0,m.index-100),m.index),after=description.slice(m.index+m[0].length,m.index+m[0].length+75);
   const clauseBefore=before.split(/[.!?;]/).at(-1).slice(-65);
   const clauseAfter=after.split(/\bwith\b|[,;.!?]/i)[0].slice(0,40);
   const local=clauseBefore+m[0]+clauseAfter;
   if(!/(?:floor\s*(?:area|space)|internal\s*area|total\s*area|accommodation|(?:house|home|apartment|property)\s+(?:offers?|provides?|extends?)|offering|extending|set over)/i.test(before)&&!/^\s*(?:of\s+(?:(?:[a-z-]+\s+){0,2}accommodation|(?:living\s+)?space)|in total)/i.test(after))continue;
   if(/\b(?:terraces?|balcon(?:y|ies)|gardens?|plots?|sites?|sheds?|garages?|stores?|outbuildings?|proposed|planning permission|to erect|extension)\b/i.test(local)||/\b(?:ground|first|second)\s+floor\s+(?:area|space)\s*(?:of|is|:)?\s*$/i.test(clauseBefore))continue;
   const range=/(?:\d\s*(?:[-–—/]|to|and)|between\s+[^.!?]{0,30}|[.,−-])\s*$/i.test(before);
   if(range)continue;
   const originalValue=Number(m[2].replaceAll(',',''));if(!Number.isFinite(originalValue)||originalValue<=0)continue;
   const unit=/feet|ft/i.test(m[3])?'sq ft':'sq m';
   const value=unit==='sq m'?Math.round(originalValue*10.76391041671*10)/10:originalValue;
   const modifier=(m[1]||'').toLowerCase();
   const qualifier=/under|less than|up to|at most|nearly|almost/.test(modifier)?'upper':/over|more than|in excess|at least/.test(modifier)?'lower':modifier?'approximate':'exact';
   if(!evidence.some(e=>e.value===value&&e.qualifier===qualifier))evidence.push({value,originalValue,unit,qualifier,modifier,wording:(before+m[0]+after).trim()});
  }
 }
 if(!evidence.length)return {area:null};
 // Metric/imperial figures may differ slightly through advertised rounding.
 const smallest=Math.min(...evidence.map(e=>e.value));
 const priority={upper:0,approximate:1,exact:2,lower:3};
 const chosen=evidence.filter(e=>e.value===smallest).sort((a,b)=>priority[a.qualifier]-priority[b.qualifier])[0];
 return {area:chosen.value,areaQualifier:chosen.qualifier,areaModifier:chosen.modifier,areaConflict:evidence.some(e=>Math.abs(e.value-smallest)>Math.max(1,smallest*.01)),areaEvidence:evidence};
}
async function request(url) {
  if(![ORIGIN,SWOFFERS].includes(new URL(url).origin))throw Error('Unexpected collection origin');
  for(let attempt=0;attempt<3;attempt++){
    try{
      const r=await fetch(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(30000)});
      if(!r.ok){const error=Error(`Source returned HTTP ${r.status}: ${url}`);error.retryable=r.status===429||r.status>=500;throw error}
      return await r.text();
    }catch(error){if(attempt===2||error.retryable===false)throw error;await delay(1000*(attempt+1))}
  }
}
function robotsAllows(robots, pathname) {
  const groups=[];let group=null;
  for(const line of robots.split(/\r?\n/)) {
    const m=line.replace(/#.*/,'').match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);if(!m)continue;
    const key=m[1].toLowerCase(),value=m[2];
    if(key==='user-agent'){if(!group||group.rules.length){group={agents:[],rules:[]};groups.push(group)}group.agents.push(value.toLowerCase())}
    else if(group&&['allow','disallow'].includes(key)&&value)group.rules.push({allow:key==='allow',value});
  }
  const named=groups.filter(g=>g.agents.some(a=>a!=='*'&&UA.toLowerCase().includes(a)));
  const chosen=named.length?named:groups.filter(g=>g.agents.includes('*'));
  const rules=chosen.flatMap(g=>g.rules).filter(r=>new RegExp('^'+r.value.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$')).test(pathname));
  rules.sort((a,b)=>b.value.length-a.value.length||Number(b.allow)-Number(a.allow));return !rules.length||rules[0].allow;
}
function parseIndex(html, market) {
  const cards=html.split('class="cb-card-property"').slice(1);
  const expected=Number(text(html).match(/Showing .*? of (\d+) properties/)?.[1]);
  if(!cards.length||!expected||cards.length!==expected)throw Error(`${market} coverage mismatch: ${cards.length} cards, ${expected} reported. Refusing incomplete refresh.`);
  return cards.map(card=>{
    const url=card.match(/href="(https:\/\/www\.cooperbrouard\.com\/property\/\d+\/)"/)?.[1];
    if(!url)throw Error('Unrecognised listing card');
    const location=text(card.match(/<h3 class="h4">[\s\S]*?<\/h3><\/a><span>([\s\S]*?)<\/span>/)?.[1]);
    const flags=text(card.match(/<ul class="cb-card-property-flags">([\s\S]*?)<\/ul>/)?.[1]);
    return {url,market,location,flags};
  });
}
function parseProperty(html, card, now) {
  const body=html.match(/<body[^>]*class="([^"]+)"/)?.[1]||'';
  if(!body.includes('department-residential-sales')||!body.includes('on-market-yes'))return null;
  if(/availability-(sold|let|withdrawn)/.test(body))return null;
  const status=body.includes('availability-under-offer')?'under':body.includes('availability-for-sale')?'available':null;
  if(!status)throw Error('Unrecognised sale status: '+card.url);
  const graphs=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const residence=graphs.find(g=>[].concat(g['@type']||[]).some(t=>['Residence','SingleFamilyResidence','Apartment','House'].includes(t)));
  const listing=graphs.find(g=>g.offers);
  if(!residence||!listing||!residence.name)throw Error('Missing structured property data: '+card.url);
  if(!String(listing.offers.businessFunction).endsWith('#Sell'))return null;
  const sourceTypes=[...body.matchAll(/property_type-([\w-]+)/g)].map(m=>m[1]);
  const dwellingTypes=['chalet-bungalow','bungalow','detached-bungalow','flat-apartment','flat','apartment','cottage','chalet','detached-house','semi-detached-house','terraced-house','house'];
  const rawType=dwellingTypes.find(t=>sourceTypes.includes(t))||sourceTypes[0]||'';
  if(/^(land|commercial|development-land|building-plot|garage|parking)$/.test(rawType))return null;
  const typeMap={'flat-apartment':'Apartment',flat:'Apartment',apartment:'Apartment','detached-house':'House','semi-detached-house':'House','terraced-house':'House',house:'House',bungalow:'Bungalow','detached-bungalow':'Bungalow','chalet-bungalow':'Chalet bungalow',cottage:'Cottage'};
  const type=typeMap[rawType]||text(rawType.replace(/-/g,' ')).replace(/^./,c=>c.toUpperCase())||null;
  const location=card.location||text(html.match(/cb-single-property-header__bottom">\s*<p>([\s\S]*?)<\/p>/)?.[1]);
  let parish=location.replace(/\s+GY\d.*$/i,'').trim().replaceAll('’',"'");
  if(parish==='St Pierre du Bois')parish="St Peter's";
  if(!/^(Castel|Forest|Vale|Torteval|St )/.test(parish))throw Error('Unknown location: '+card.url);
  const priceLabel=text(html.match(/cb-single-property-header__top">[\s\S]*?<h2>([\s\S]*?)<\/h2>/)?.[1]);
  const price=askingPrice(priceLabel,listing.offers.price);
  if(price===null)return null;
  const description=text(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1]);
  // Some current source listings omit their description; retain them explicitly empty.
  const photos=[...new Set([].concat(residence.image||[]).filter(u=>typeof u==='string'&&/^https:\/\/(cdn\.)?cooperbrouard\.com\//.test(u)))];
  const features=html.match(/<div class="cb-single-property-key-features">([\s\S]*?)<\/ul>/)?.[1]||'';
  return {id:Number(card.url.match(/property\/(\d+)/)[1]),source:'cooper-brouard',name:text(residence.name),agent:'Cooper Brouard',market:card.market,price,priceLabel:price===null?'Price on application':priceLabel,beds:Number.isFinite(Number(residence.numberOfBedrooms))&&residence.numberOfBedrooms!=null?Number(residence.numberOfBedrooms):null,type,sourceType:rawType,sourceTypes,parish,location,address:text(residence.address?.streetAddress),description,url:card.url,photos,status,date:listing.datePosted||listing.datePublished||null,lastSeen:now,...advertisedPlot(description,features),...advertisedFloor(description,features),parking:null,south:null,garden:null,refurb:null,development:null};
}
let running=null;
function collect(){if(running)return running;running=run().finally(()=>running=null);return running}
async function collectCooperBrouard(started){
  const robots=await request(ORIGIN+'/robots.txt');
  async function permitted(url){if(!robotsAllows(robots,new URL(url).pathname))throw Error('Collection disallowed by robots.txt: '+url);await delay(500);return request(url)}
  const cards=[];
  for(const [route,market] of [['/local-market/','Local Market'],['/open-market/','Open Market']])cards.push(...parseIndex(await permitted(ORIGIN+route),market));
  const unique=[...new Map(cards.map(c=>[c.url,c])).values()];
  const properties=[];let excluded=0;
  for(const card of unique){
    if(/Sold|Let |Let$/.test(card.flags)||/Alderney|Sark|Herm/i.test(card.location)){excluded++;continue}
    const p=parseProperty(await permitted(card.url),card,started);if(p)properties.push(p);else excluded++;
    if((properties.length+excluded)%20===0)console.log(`Collected ${properties.length}; excluded ${excluded} of ${unique.length}`);
  }
  if(!properties.length)throw Error('No residential properties collected; previous data retained');
  return {properties,coverage:{markets:['Local Market','Open Market'],discovered:unique.length,collected:properties.length,excluded}};
}

function swoffersField(html, className, tag='div'){
  return html.match(new RegExp('<'+tag+'[^>]*class="'+className+'(?: [^"]*)?"[^>]*>([\\s\\S]*?)</'+tag+'>'))?.[1]||'';
}
function parseSwoffersIndex(html, pageUrl){
  const countText=text(swoffersField(html,'property-search-results__heading-count','span'));
  if(!/^\d+$/.test(countText))throw Error('Missing Swoffers result count: '+pageUrl);
  const cards=html.split(/<div class="property-item property-grid__item\b/).slice(1).map(part=>{
    const header=part.slice(0,part.indexOf('>'));
    const sourceId=Number(header.match(/data-property-id="(\d+)"/)?.[1]);
    const url=part.match(/href="(https:\/\/swoffers\.co\.uk\/property\/[^"?#]+)"/)?.[1];
    const name=text(header.match(/data-property-title="([^"]+)"/)?.[1]);
    const status=/\bunderoffer\b/.test(header)?'under':/\bforsale\b/.test(header)?'available':null;
    const agentText=text(swoffersField(part,'property-grid__item-agent'));
    const market=agentText.includes('Local Market')?'Local Market':agentText.includes('Open Market')?'Open Market':null;
    if(!Number.isSafeInteger(sourceId)||sourceId<=0||!url||!name)throw Error('Unrecognised Swoffers card: '+pageUrl);
    return {sourceId,url,name,status,market,location:text(swoffersField(part,'property-grid__item-area','span')),priceLabel:text(swoffersField(part,'property-grid__item-price','span'))};
  });
  const nextMatch=html.match(/<a class="next page-numbers" href="([^"]+)"/);
  const next=nextMatch?new URL(text(nextMatch[1]),pageUrl).href:null;
  if(next&&(new URL(next).origin!==SWOFFERS||!new URL(next).pathname.startsWith('/property-search/')))throw Error('Unexpected Swoffers pagination URL');
  const expected=Number(countText);
  if((expected>0&&!cards.length)||cards.length>expected)throw Error('Swoffers coverage mismatch: '+pageUrl);
  return {cards,expected,next};
}
function parseSwoffersProperty(html,card,now){
  const sourceId=Number(html.match(/\bpostid-(\d+)\b/)?.[1]);
  if(sourceId!==card.sourceId)throw Error('Swoffers detail identity mismatch: '+card.url);
  const rawStatus=html.match(/class="property-hero__status" data-status="([^"]+)"/)?.[1];
  if(['sold','sold-stc','let','let-agreed','to-let','for-rent','withdrawn'].includes(rawStatus))return null;
  const status=rawStatus==='for-sale'?'available':rawStatus==='under-offer'?'under':null;
  if(!status)throw Error('Unknown Swoffers status '+rawStatus+': '+card.url);
  const priceLabel=text(swoffersField(html,'property-hero__price'));
  const price=askingPrice(priceLabel);
  if(price===null||askingPrice(card.priceLabel)===null)return null;
  const location=text(swoffersField(html,'property-bar__details-area','span'))||card.location;
  const parish=location.replaceAll('’',"'").replace(/^St\.?\s+/,'St ').replace(/^St Pierre du Bois$/,"St Peter's");
  if(/Alderney|Sark|Herm/i.test(parish))return null;
  if(!['Castel','Forest','Vale','Torteval',"St Andrew's","St Martin's",'St Peter Port',"St Peter's","St Sampson's","St Saviour's"].includes(parish))throw Error('Unknown Swoffers parish '+parish);
  const bedsText=text(swoffersField(html,'property-bar__details-bedrooms','span'));
  const bedsMatch=bedsText.match(/^(\d+)\s+Bedrooms?$/i);
  const beds=bedsMatch?Number(bedsMatch[1]):null;
  const name=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
  if(!name)throw Error('Missing Swoffers property name: '+card.url);
  // Source type filters supply categories; no property type is guessed from a name.
  // Untyped listings need explicit bedrooms to qualify as residential.
  if(!card.type&&!(beds>0))return null;
  if(/^(?:plot\b|land\b|field\b|garage\b|parking\b)|\bbuilding plots?\b|\bcommercial units?\b/i.test(name)&&!card.type)return null;
  const description=text(swoffersField(html,'property-main__overview'));
  const photos=[...new Set([...html.matchAll(/<img\b[^>]*src="(https:\/\/assets\.reapit\.net\/swf\/live\/pictures\/[^"?]+)(?:\?[^"]*)?"[^>]*class="property-hero__carousel-image"/g)].map(m=>text(m[1])))];
  const graphs=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const page=graphs.find(g=>g['@type']==='WebPage');
  const address=text(swoffersField(html,'property-main__locale-area'));
  // Negative IDs reserve a separate namespace without changing existing CB IDs or notes.
  const features=text(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1]);
  return {id:-sourceId,source:'swoffers',name,agent:'Swoffers',market:card.market,price,priceLabel,beds,type:card.type||null,sourceType:card.sourceType||null,parish,location,address,description,url:card.url,photos,status,date:page?.datePublished||null,lastSeen:now,...advertisedPlot(description,features),...advertisedFloor(description,features),parking:null,south:null,garden:null,refurb:null,development:null};
}
async function collectSwoffers(started){
  const robots=await request(SWOFFERS+'/robots.txt');
  async function permitted(url){if(!robotsAllows(robots,new URL(url).pathname))throw Error('Collection disallowed by robots.txt: '+url);await delay(500);return request(url)}
  async function search(query){
    let url=SWOFFERS+'/property-search?'+query,expected=null;const cards=[],visited=new Set();
    while(url){
      if(visited.has(url)||visited.size>=100)throw Error('Swoffers pagination loop');visited.add(url);
      const page=parseSwoffersIndex(await permitted(url),url);
      if(expected!==null&&expected!==page.expected)throw Error('Swoffers result count changed during refresh');expected=page.expected;
      cards.push(...page.cards);url=page.next;
    }
    if(cards.length!==expected||new Set(cards.map(c=>c.sourceId)).size!==expected)throw Error(`Swoffers coverage mismatch: ${cards.length} cards, ${expected} expected`);
    return cards;
  }
  const cards=await search('market=sales');
  if(!cards.length)throw Error('No Swoffers listings; previous feed retained');
  const typeMap=new Map();
  for(const [sourceType,type] of [['bungalow','Bungalow'],['house','House'],['flat-apartment','Apartment']]){
    for(const card of await search('market=sales&type='+sourceType))if(!typeMap.has(card.sourceId))typeMap.set(card.sourceId,{type,sourceType});
  }
  const properties=[];let excluded=0;
  for(const card of cards){
    if(!card.market||!card.status||/Alderney|Sark|Herm/i.test(card.location)||askingPrice(card.priceLabel)===null){excluded++;continue}
    const p=parseSwoffersProperty(await permitted(card.url),{...card,...typeMap.get(card.sourceId)},started);
    if(p)properties.push(p);else excluded++;
    if((properties.length+excluded)%20===0)console.log(`Swoffers: collected ${properties.length}; excluded ${excluded} of ${cards.length}`);
  }
  if(!properties.length)throw Error('No priced Swoffers residential properties; previous feed retained');
  return {properties,coverage:{markets:['Local Market','Open Market'],discovered:cards.length,collected:properties.length,excluded}};
}
async function run(){
  const started=new Date().toISOString();
  const cb=await collectCooperBrouard(started);
  const sw=await collectSwoffers(started);
  const properties=[...cb.properties,...sw.properties];
  if(properties.some(p=>!Number.isFinite(p.price)||p.price<=0)||new Set(properties.map(p=>p.id)).size!==properties.length)throw Error('Invalid combined feed; previous data retained');
  const data={schemaVersion:1,agent:'Cooper Brouard and Swoffers',agents:['Cooper Brouard','Swoffers'],sourceUrl:ORIGIN,sourceUrls:[ORIGIN,SWOFFERS],generatedAt:new Date().toISOString(),startedAt:started,coverage:{markets:['Local Market','Open Market'],discovered:cb.coverage.discovered+sw.coverage.discovered,collected:properties.length,excluded:cb.coverage.excluded+sw.coverage.excluded,sources:{'cooper-brouard':cb.coverage,swoffers:sw.coverage}},properties};
  await fs.writeFile(DATA+'.tmp',JSON.stringify(data,null,2)+'\n');await fs.rename(DATA+'.tmp',DATA);
  console.log(`Published ${properties.length} current residential listings`);return data;
}
module.exports={collect,parseIndex,parseProperty,robotsAllows,text,askingPrice,advertisedPlot,advertisedFloor,parseSwoffersIndex,parseSwoffersProperty,collectSwoffers,collectCooperBrouard};
if(require.main===module)collect().catch(error=>{console.error(error.message);process.exitCode=1});



