const fs = require('node:fs/promises');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');
const ORIGIN = 'https://www.cooperbrouard.com';
const DATA = path.join(__dirname, 'properties.json');
const UA = 'GuernseyPropertyFinder/1.0 (private property search; low-frequency collector)';
function text(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|pound|rsquo|lsquo|ndash|mdash);/gi, (_, e) => {
    if(e[0]==='#')return String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1)));
    return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',pound:'£',rsquo:"'",lsquo:"'",ndash:'–',mdash:'—'}[e.toLowerCase()];
  }).replace(/\s+/g,' ').trim();
}
async function request(url) {
  if(new URL(url).origin!==ORIGIN)throw Error('Unexpected collection origin');
  const r=await fetch(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error(`Source returned HTTP ${r.status}: ${url}`);
  return r.text();
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
  const price=/POA|application/i.test(priceLabel)?null:Number(listing.offers.price)||null;
  const description=text(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1]);
  // Some current source listings omit their description; retain them explicitly empty.
  const photos=[...new Set([].concat(residence.image||[]).filter(u=>typeof u==='string'&&/^https:\/\/(cdn\.)?cooperbrouard\.com\//.test(u)))];
  return {id:Number(card.url.match(/property\/(\d+)/)[1]),source:'cooper-brouard',name:text(residence.name),agent:'Cooper Brouard',market:card.market,price,priceLabel:price===null?'Price on application':priceLabel,beds:Number.isFinite(Number(residence.numberOfBedrooms))&&residence.numberOfBedrooms!=null?Number(residence.numberOfBedrooms):null,type,sourceType:rawType,sourceTypes,parish,location,address:text(residence.address?.streetAddress),description,url:card.url,photos,status,date:listing.datePosted||listing.datePublished||null,lastSeen:now,plot:null,area:null,parking:null,south:null,garden:null,refurb:null,development:null};
}
let running=null;
function collect(){if(running)return running;running=run().finally(()=>running=null);return running}
async function run(){
  const started=new Date().toISOString();
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
  const data={schemaVersion:1,agent:'Cooper Brouard',sourceUrl:ORIGIN,generatedAt:new Date().toISOString(),startedAt:started,coverage:{markets:['Local Market','Open Market'],discovered:unique.length,collected:properties.length,excluded},properties};
  await fs.writeFile(DATA+'.tmp',JSON.stringify(data,null,2)+'\n');await fs.rename(DATA+'.tmp',DATA);
  console.log(`Published ${properties.length} current residential listings`);return data;
}
module.exports={collect,parseIndex,parseProperty,robotsAllows,text};
if(require.main===module)collect().catch(error=>{console.error(error.message);process.exitCode=1});



