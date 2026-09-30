const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const target=path.join(__dirname,'_site');await fs.mkdir(target,{recursive:true});
 for(const name of ['index.html','app.js','sw.js','manifest.json','icon-192.png','icon-512.png','properties.json'])await fs.copyFile(path.join(__dirname,name),path.join(target,name));
 await fs.writeFile(path.join(target,'.nojekyll'),'');
 console.log('Static site prepared in _site');
})().catch(error=>{console.error(error);process.exitCode=1});
