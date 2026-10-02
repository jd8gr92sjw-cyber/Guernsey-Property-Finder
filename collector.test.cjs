const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {parseProperty,parseIndex,robotsAllows,collect,askingPrice,parseSwoffersIndex,parseSwoffersProperty,collectSwoffers}=require('./collector.cjs');
const {parseCherryProperty,parseCherryFeed}=require('./collector.cjs');
const cherry={_id:'ea-s335',slug:{current:'ea-s335'},listingType:'buy',department:'Local Market Sales',market:{title:'Local Market'},status:{title:'On Market'},propertyType:{title:'Local Market House'},publicPrice:'£545,000',price:545000,bedrooms:3,title:'Mirabelle, St Peter Port',parish:{title:'St Peter Port'},publishedAt:'2023-05-15T09:14:00.000Z',description:'A house set in a plot of half an acre. Total floor area 1200 sq ft.',featuredImage:{asset:{url:'http://med05.expertagent.co.uk/photo.jpg'}},highlights:['Garden']};
const {parseSavillsIndex,parseSavillsProperty,collectSavills}=require('./collector.cjs');
const savills={ID:1191499,PropertyID:1191499,ExternalPropertyID:'GBGUESGUE250055',MetaInformation:{CanonicalUrl:'property-detail/gbguesgue250055'},TenureType:'GRS_T_B',PropertyTypes:[{Type:'bungalow'}],MarketTypes:[{Caption:'Local Market'}],ShowPrice:true,DisplayCurrency:'GBP',DisplayPriceText:'£565,000',GuidePriceText:'Guide price',Price:565000,AddressLine1:'Heavenly',AddressLine2:'Rue De Houmet, Vale, GY6 8JH',Bedrooms:2,PropertyStatusFlag:10,PropertyStatusFlagTranslation:'New',HeaderSizeFormatted:['775 sq ft','72 sq m'],Description:'A home set in grounds of half an acre.',WebFeatureList:[],PropertyCardImagesGallery:[{ImageUrl_L:'https://assets.savills.com/properties/photo.jpg'},{ImageUrl_L:'https://assets.savills.com.evil.test/photo.jpg'}]};
const savillsUrl='https://search.savills.com/gg/en/list/property-for-sale/channel-islands/guernsey';
function savillsPage({count=1,current=1,total=1,next=null,records=[savills],criteria={Category:'GRS_CAT_RES',Tenure:'GRS_T_B',Currency:'GBP',LocationKey:'channelislandsguernsey'}}={}){
 const ids=records.map(p=>p.ExternalPropertyID);return '<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{initialReduxState:{properties:Object.fromEntries(records.map(p=>[p.ExternalPropertyID,p])),listPage:{currentPage:current,searchedCriteria:criteria,pageMap:{[current]:{paging:{current,total,totalItems:count},results:{Properties:ids},metaData:{NextUrl:next}}}}}}})+'</script>';
}
test('Savills normalizes stable IDs, market, parish, status, approximate sizes and safe photos',()=>{
 const p=parseSavillsProperty(savills,'now');assert.equal(p.id,-2001191499);assert.equal(p.type,'Bungalow');assert.equal(p.price,565000);assert.equal(p.parish,'Vale');assert.equal(p.plot,.5);assert.equal(p.area,775);assert.equal(p.areaQualifier,'approximate');assert.equal(p.date,null);assert.equal(p.garden,null);assert.deepEqual(p.photos,['https://assets.savills.com/properties/photo.jpg']);
 const under=parseSavillsProperty({...savills,PropertyStatusFlag:1,PropertyStatusFlagTranslation:'Under offer',MarketTypes:[{Caption:'Open Market'}],AddressLine2:'Road, St Pierre Du Bois, GY7 9DP'},'now');assert.equal(under.status,'under');assert.equal(under.market,'Open Market');assert.equal(under.parish,"St Peter's");
 assert.equal(parseSavillsProperty({...savills,PropertyStatusFlag:0,PropertyStatusFlagTranslation:null,HeaderSizeFormatted:[],AddressLine2:'Guernsey, GY1 2TD'},'now').parish,null);
 assert.equal(parseSavillsProperty({...savills,AddressLine2:'Fermain Road, St Peter Port, Guernsey, GY1 2TD'},'now').parish,'St Peter Port');
 assert.throws(()=>parseSavillsProperty({...savills,PropertyStatusFlagTranslation:'Unknown'},'now'),/Unknown Savills/);
});
test('Savills excludes POA despite hidden prices, rentals, sold homes and proposed building plots',()=>{
 for(const changed of [{DisplayPriceText:'POA'},{GuidePriceText:'Price on application'},{DisplayPriceText:null},{ShowPrice:false},{Price:0,DisplayPriceText:'£0'},{IsSold:true},{IsLet:true},{IsCommercial:true},{IsConfidential:true},{TenureType:'GRS_T_L'},{PropertyTypes:[{Type:'house'},{Type:'building-plot'}]},{AddressLine2:'Road, Alderney, GY9 3AA'}])assert.equal(parseSavillsProperty({...savills,...changed},'now'),null);
 assert.throws(()=>parseSavillsProperty({...savills,Price:1},'now'),/disagree/);
});
test('Savills rejects incomplete, repeated and changed pagination and incorrect search scope',async()=>{
 assert.equal(parseSavillsIndex(savillsPage(),savillsUrl).expected,1);
 assert.throws(()=>parseSavillsIndex('<h1>Unavailable</h1>',savillsUrl),/Missing/);
 assert.throws(()=>parseSavillsIndex(savillsPage({criteria:{Category:'GRS_CAT_COM'}}),savillsUrl),/scope/);
 assert.throws(()=>parseSavillsIndex(savillsPage({total:2,next:'https://evil.test/'}),savillsUrl),/pagination/);
 const original=global.fetch;
 try{for(const mode of ['incomplete','repeated','changed']){
  let page=0;global.fetch=async url=>({ok:true,text:async()=>url.endsWith('robots.txt')?'User-agent: *\nAllow: /':(++page===1?savillsPage({count:2,total:mode==='incomplete'?1:2,next:mode==='incomplete'?null:'/gg/en/list/property-for-sale/channel-islands/guernsey/page/2'}):savillsPage({count:mode==='changed'?3:2,current:2,total:2}))});
  await assert.rejects(collectSavills('now'),/coverage mismatch|count changed/);
 }}finally{global.fetch=original}
});
test('Cherry Godfrey maps public sales, statuses, market, sizes and secure photos',()=>{
 const p=parseCherryProperty(cherry,'now');assert.equal(p.id,-1000000670);assert.equal(p.price,545000);assert.equal(p.plot,.5);assert.equal(p.area,1200);assert.equal(p.garden,null);assert.equal(p.url,'https://www.cherrygodfreyproperty.com/buy/property/ea-s335');assert.deepEqual(p.photos,['https://med05.expertagent.co.uk/photo.jpg']);
 assert.equal(parseCherryProperty({...cherry,status:{title:'Under offer with Cherry Godfrey Property'},parish:null},'now').status,'under');assert.equal(parseCherryProperty({...cherry,parish:null},'now').parish,null);
 const open=parseCherryProperty({...cherry,market:{title:'Open Market'},department:'Open Market Sales',status:{title:'Open Market'},parish:{title:'St Martin'}},'now');assert.equal(open.market,'Open Market');assert.equal(open.parish,"St Martin's");
 for(const changed of [{status:{title:'Sold by Cherry Godfrey Property'}},{propertyType:{title:'Agricultural Field'}},{isPrivateListing:true},{listingType:'rent'},{publicPrice:'POA'}])assert.equal(parseCherryProperty({...cherry,...changed},'now'),null);
});
test('Cherry Godfrey rejects incomplete or duplicate feeds before publication',()=>{
 const feed={success:true,schemaMatches:true,isSyncing:false,count:1,properties:[cherry]};assert.equal(parseCherryFeed(feed,'now').coverage.collected,1);
 for(const changed of [{success:false},{schemaMatches:false},{isSyncing:true},{count:2},{count:2,properties:[cherry,cherry]}])assert.throws(()=>parseCherryFeed({...feed,...changed},'now'),/Incomplete/);
 assert.throws(()=>parseCherryProperty({...cherry,price:1},'now'),/disagree/);
});
const card={url:'https://www.cooperbrouard.com/property/123/',market:'Local Market',location:'St Martin\'s GY4 6LR'};
function html({status='for-sale',department='residential-sales',description='A &amp; B',price=895000,bedrooms=3,label='£895,000',type='bungalow'}={}){return `<body class="availability-${status} department-${department} on-market-yes property_type-${type}"><meta property="og:description" content="${description}"><div class="cb-single-property-header__top"><h2>${label}</h2></div><script type="application/ld+json">${JSON.stringify({'@graph':[{'@type':['Residence','SingleFamilyResidence'],name:'A &amp; B',numberOfBedrooms:bedrooms,image:['https://cdn.cooperbrouard.com/media/photo.jpg','javascript:bad'],address:{streetAddress:'Road'}},{offers:{price,businessFunction:'https://purl.org/goodrelations/v1#Sell'},datePosted:'2026-09-01'}]})}</script>`}
test('extracts explicit facts and safe photo URLs without inventing garden facts',()=>{const p=parseProperty(html(),card,'now');assert.equal(p.price,895000);assert.equal(p.beds,3);assert.equal(p.type,'Bungalow');assert.equal(p.description,'A & B');assert.equal(p.parking,null);assert.equal(p.garden,null);assert.equal(p.photos.length,1)});
test('preserves missing optional fields on numerically priced listings',()=>{const p=parseProperty(html({description:'',type:'',bedrooms:null}),card,'now');assert.equal(p.price,895000);assert.equal(p.type,null);assert.equal(p.beds,null);assert.equal(p.description,'')});
test('excludes sold, rental, and land; retains under-offer status',()=>{assert.equal(parseProperty(html({status:'sold'}),card,'now'),null);assert.equal(parseProperty(html({department:'residential-lettings'}),card,'now'),null);assert.equal(parseProperty(html({type:'land'}),card,'now'),null);assert.equal(parseProperty(html({status:'under-offer'}),card,'now').status,'under')});
test('maps St Pierre du Bois to existing parish filter',()=>assert.equal(parseProperty(html(),{...card,location:'St Pierre du Bois GY7 9AA'},'now').parish,"St Peter's"));
test('index coverage changes fail closed',()=>assert.throws(()=>parseIndex('Showing 1–1 of 2 properties<div class="cb-card-property"><a href="https://www.cooperbrouard.com/property/123/">','Local Market'),/coverage mismatch/));
test('robots uses specific rules, wildcard paths and longest allow',()=>{assert.equal(robotsAllows('User-agent: *\nDisallow:', '/property/1/'),true);assert.equal(robotsAllows('User-agent: *\nDisallow: /property/', '/property/1/'),false);assert.equal(robotsAllows('User-agent: *\nDisallow: /property/\nAllow: /property/1/', '/property/1/'),true);assert.equal(robotsAllows('User-agent: GuernseyPropertyFinder\nDisallow: /\nUser-agent: *\nAllow: /', '/property/1/'),false)});
test('network failure preserves previous published feed',async()=>{const file=path.join(__dirname,'properties.json');const before=await fs.readFile(file);const original=global.fetch;global.fetch=async()=>{throw Error('Simulated source outage')};try{await assert.rejects(collect(),/Simulated source outage/)}finally{global.fetch=original}assert.deepEqual(await fs.readFile(file),before)});

test('uses dwelling type when investment and garage tags precede it',()=>{assert.equal(parseProperty(html({type:'garage property_type-house'}),card,'now').type,'House');assert.equal(parseProperty(html({type:'buy-to-let-investment property_type-flat-apartment'}),card,'now').type,'Apartment')});

test('all collectors require an advertised positive numerical asking price',()=>{
 for(const label of ['POA','P.O.A.','Price on Application','Price on Request','Price upon request','POR','Contact agent','','£0','£-1','£1m','£12,34']){
  assert.equal(askingPrice(label,895000),null,label);
  assert.equal(parseProperty(html({label}),card,'now'),null,label);
 }
 assert.equal(askingPrice('Offers in excess of £895,000',895000),895000);
 assert.equal(askingPrice('GBP 895000.00','895000'),895000);
 assert.throws(()=>askingPrice('£895,000',850000),/disagree/);
});
function swoffersCard({id=32835,name='Example',price='&pound;360,000',status='forsale',market='Local Market',area='Castel'}={}){
 return `<div class="property-item property-grid__item reveal ${status}" data-property-id="${id}" data-property-title="${name}"><a href="https://swoffers.co.uk/property/example-${id}">Details</a><span class="property-grid__item-price">${price}</span><span class="property-grid__item-area">${area}</span><div class="property-grid__item-agent"><span>${market}</span></div></div>`;
}
function swoffersIndex({count=1,cards=swoffersCard(),next=''}={}){return `<span class="property-search-results__heading-count">${count}</span>${cards}${next?`<a class="next page-numbers" href="${next}">Next</a>`:''}`}
const swoffersUrl='https://swoffers.co.uk/property-search?market=sales';
function swoffersDetail({id=32835,status='for-sale',price='&pound;360,000',area='Castel',beds='1 Bedrooms'}={}){
 return `<body class="single-property postid-${id}"><div class="property-hero__status" data-status="${status}">Status</div><h1>Example &amp; Home</h1><div class="property-hero__price">${price}</div><span class="property-bar__details-area">${area}</span><span class="property-bar__details-bedrooms">${beds}</span><div class="property-main__overview entry-content"><p>A coastal home.</p></div><div class="property-main__locale-area">Road, ${area}</div><img src="https://assets.reapit.net/swf/live/pictures/LMA/26/photo.jpg?t=1" class="property-hero__carousel-image"><img src="https://assets.reapit.net/swf/live/pictures/LMA/26/photo.jpg?t=2" class="property-hero__carousel-image"><img src="https://evil.example/photo.jpg" class="property-hero__carousel-image">`;
}
const sc=()=>({...parseSwoffersIndex(swoffersIndex(),swoffersUrl).cards[0],type:'Bungalow',sourceType:'bungalow'});
test('floor totals preserve qualifiers, convert metric units and retain evidence',()=>{
 const {advertisedFloor}=require('./collector.cjs');
 assert.equal(advertisedFloor('Total floor area: 1,500 sq ft').area,1500);
 assert.equal(advertisedFloor('Internal area 100 m²').area,1076.4);
 assert.equal(advertisedFloor('Floor area 100 square metres').areaEvidence[0].unit,'sq m');
 assert.equal(advertisedFloor('Offering approximately 3,000sqft with planning permission to extend.').areaQualifier,'approximate');
 assert.equal(advertisedFloor('Offers over 2,000 sq. ft. of light-filled accommodation.').areaQualifier,'lower');
 assert.equal(advertisedFloor('The house extends to nearly 6,000 sq ft.').areaQualifier,'upper');
 const conflict=advertisedFloor('Total floor area 1800 sqft','Total floor area 1700 sqft');assert.equal(conflict.area,1700);assert.equal(conflict.areaConflict,true);
 const rounded=advertisedFloor('Internal floor area 100 sq m','Internal floor area 1076 sq ft');assert.equal(rounded.areaConflict,false);
});
test('floor extraction rejects rooms, terraces, outbuildings, proposed space and partial floors',()=>{
 const {advertisedFloor}=require('./collector.cjs');
 for(const s of ['Kitchen 5m x 4m.','Total terrace area 500 sqft','Floor area of garage 600 sq ft','Proposed floor area 1200 sqft','Planning permission to erect a 1,230 sq ft dwelling.','Ground floor area 1500 sqft','Floor area between 1000 and 1500 sqft','Floor area .5 sq m','Floor area -200 sq ft'])assert.equal(advertisedFloor(s).area,null,s);
 const p=advertisedFloor('The apartment offers 3,200sqft of space, located in town. A large terrace of approximately 500 sqft.');assert.equal(p.area,3200);assert.equal(p.areaEvidence.length,1);
});
test('both agent parsers populate advertised floor totals without room calculations',()=>{
 const cb=parseProperty(html({description:'Total floor area approximately 100 sq m.'}),card,'now');assert.equal(cb.area,1076.4);assert.equal(cb.areaQualifier,'approximate');
 const sw=parseSwoffersProperty(swoffersDetail().replace('A coastal home.','Offering over 2,000 sq. ft. of accommodation.'),sc(),'now');assert.equal(sw.area,2000);assert.equal(sw.areaQualifier,'lower');
});
test('Swoffers parses exact facts, source type and photographs with separate stable IDs',()=>{
 const p=parseSwoffersProperty(swoffersDetail(),sc(),'now');
 assert.equal(p.id,-32835);assert.equal(p.source,'swoffers');assert.equal(p.agent,'Swoffers');assert.equal(p.price,360000);assert.equal(p.beds,1);assert.equal(p.type,'Bungalow');assert.equal(p.name,'Example & Home');assert.equal(p.description,'A coastal home.');assert.equal(p.address,'Road, Castel');assert.deepEqual(p.photos,['https://assets.reapit.net/swf/live/pictures/LMA/26/photo.jpg']);assert.equal(p.garden,null);
});
test('Swoffers rejects unpriced detail even when search card has a price, and conversely',()=>{
 for(const price of ['POA','Price on Application','Price on Request','','£0']){
  assert.equal(parseSwoffersProperty(swoffersDetail({price}),sc(),'now'),null);
  assert.equal(parseSwoffersProperty(swoffersDetail(),{...sc(),priceLabel:price},'now'),null);
 }
});
test('Swoffers excludes sold/rentals/other islands/nonresidential and preserves under offer',()=>{
 for(const status of ['sold','let','to-let','withdrawn'])assert.equal(parseSwoffersProperty(swoffersDetail({status}),sc(),'now'),null);
 assert.equal(parseSwoffersProperty(swoffersDetail({area:'Alderney'}),sc(),'now'),null);
 assert.equal(parseSwoffersProperty(swoffersDetail({beds:'0 Bedrooms'}),{...sc(),type:null},'now'),null);
 assert.equal(parseSwoffersProperty(swoffersDetail({status:'under-offer'}),sc(),'now').status,'under');
 assert.throws(()=>parseSwoffersProperty(swoffersDetail({id:5}),sc(),'now'),/identity mismatch/);
 assert.throws(()=>parseSwoffersProperty(swoffersDetail({status:'unknown'}),sc(),'now'),/Unknown Swoffers status/);
});
test('Swoffers parser validates page totals and decodes pagination query',()=>{
 const result=parseSwoffersIndex(swoffersIndex({next:'https://swoffers.co.uk/property-search/page/2/?market=sales&amp;type=house'}),swoffersUrl);
 assert.equal(result.expected,1);assert.equal(result.next,'https://swoffers.co.uk/property-search/page/2/?market=sales&type=house');
 assert.throws(()=>parseSwoffersIndex('<h1>Temporarily unavailable</h1>',swoffersUrl),/Missing Swoffers/);
 assert.throws(()=>parseSwoffersIndex(swoffersIndex({count:2,cards:''}),swoffersUrl),/coverage mismatch/);
 assert.throws(()=>parseSwoffersIndex(swoffersIndex({next:'https://evil.example/'}),swoffersUrl),/pagination/);
});
test('Swoffers refuses incomplete, repeated, and changing pagination rather than publishing partial results',async()=>{
 const original=global.fetch;
 try{
  for(const mode of ['incomplete','duplicate','changed']){
   let pages=0;
   global.fetch=async url=>({ok:true,text:async()=>url.endsWith('robots.txt')?'User-agent: *\nDisallow:':(++pages===1?swoffersIndex({count:2,next:mode==='incomplete'?'':'https://swoffers.co.uk/property-search/page/2/?market=sales'}):swoffersIndex({count:mode==='changed'?3:2}))});
   await assert.rejects(collectSwoffers('now'),/coverage mismatch|count changed/);
  }
 }finally{global.fetch=original}
});
test('a Swoffers outage after successful Cooper Brouard collection preserves the complete previous feed',async()=>{
 const file=path.join(__dirname,'properties.json'),before=await fs.readFile(file),original=global.fetch;
 global.fetch=async url=>{
  if(url.startsWith('https://swoffers.co.uk'))throw Error('Swoffers unavailable');
  return {ok:true,text:async()=>url.endsWith('robots.txt')?'User-agent: *\nDisallow:':url.includes('/property/')?html():`Showing 1 of 1 properties<div class="cb-card-property"><a href="${card.url}"><h3 class="h4">Test</h3></a><span>St Martin's GY4 6LR</span>`};
 };
 try{await assert.rejects(collect(),/Swoffers unavailable/)}finally{global.fetch=original}
 assert.deepEqual(await fs.readFile(file),before);
});

test('Swoffers excludes building plots advertising proposed bedroom counts',()=>{assert.equal(parseSwoffersProperty(swoffersDetail({beds:'3 Bedrooms'}).replace('Example &amp; Home','Approved Building Plots'),{...sc(),type:null},'now'),null)});

const {advertisedPlot}=require('./collector.cjs');
test('advertised plot sizes preserve explicit numbers and qualifications',()=>{
 for(const [wording,value,qualifier] of [
  ['A total site of 2.5 acres.',2.5,'exact'],
  ['A plot of approximately half an acre.',.5,'approximate'],
  ['A plot of around a half an acre.',.5,'approximate'],
  ['Gardens of around 1.5 acres.',1.5,'approximate'],
  ['Grounds extend over two acres.',2,'lower'],
  ['A plot of just under half an acre.',.5,'upper'],
  ['A plot of nearly half an acre.',.5,'upper'],
  ['A plot of up to 1 acre.',1,'upper'],
  ['The site is at least 2 acres.',2,'lower'],
  ['A total site of approx. four and a half acres.',4.5,'approximate'],
  ['A plot of a quarter of an acre.',.25,'exact'],
  ['A 0.75-acre plot.',.75,'exact']
 ]){const p=advertisedPlot(wording);assert.equal(p.plot,value,wording);assert.equal(p.plotQualifier,qualifier);assert.ok(p.plotEvidence[0].wording.includes('acre'))}
});
test('plot extraction leaves partial, range and unrelated measurements unconfirmed',()=>{
 for(const wording of [
  'Gardens of 1.5 acres plus a field of 2 acres.',
  'A further parcel of 0.84 acres.',
  'An agricultural field of 3.2 acres.',
  'A plot of between 1 and 2 acres.',
  'A site of 0.5-0.75 acres.',
  'A plot of 1/2 an acre.',
  'A plot of .5 acres.',
  'A plot of -2 acres.',
  'Views across 10 acres of neighbouring land.',
  'The nearby park has 20 acres.',
  'No plot size stated; kitchen 5m x 4m.'
 ])assert.equal(advertisedPlot(wording).plot,null,wording);
 const conflict=advertisedPlot('A plot of around half an acre.','A plot of just under half an acre.');
 assert.equal(conflict.plot,.5);assert.equal(conflict.plotQualifier,'upper');assert.equal(conflict.plotConflict,true);
 const different=advertisedPlot('A total site of 2.5 acres.','A total site of 2 acres.');
 assert.equal(different.plot,2);assert.equal(different.plotConflict,true);assert.equal(different.plotEvidence.length,2);
 assert.equal(advertisedPlot('Total site of 2.5 acres.','Total site of 2.5 acres.').plot,2.5);
});
test('both property parsers collect plot evidence from their listing descriptions and features',()=>{
 const cb=parseProperty(html({description:'A site of approximately 0.6 acres.'}),card,'now');
 assert.equal(cb.plot,.6);assert.equal(cb.plotQualifier,'approximate');assert.equal(cb.area,null);
 const conflict=parseProperty(html({description:'A plot of around half an acre.'})+'<div class="cb-single-property-key-features"><ul><li>Plot just under half an acre</li></ul></div>',card,'now');
 assert.equal(conflict.plot,.5);assert.equal(conflict.plotQualifier,'upper');assert.equal(conflict.plotEvidence.length,2);
 const sw=parseSwoffersProperty(swoffersDetail().replace('A coastal home.','A total site of 2.5 acres.'),sc(),'now');
 assert.equal(sw.plot,2.5);assert.equal(sw.plotQualifier,'exact');assert.equal(sw.area,null);
 const featureOnly=parseSwoffersProperty(swoffersDetail()+'<meta property="og:description" content="Gardens of approx 1 acre">',sc(),'now');
 assert.equal(featureOnly.plot,1);assert.equal(featureOnly.plotQualifier,'approximate');
});
