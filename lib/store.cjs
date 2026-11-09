const fs=require('node:fs');
const path=require('node:path');
const defaults={location:'',watch:true,background:true,login:false,menubar:true,notchDisplay:'window',output:'default',remember:true,gapless:true,sleep:'off',motion:true,effects:false,concurrent:'1'};
function settings(input={},base=defaults){const out={...base};for(const [key,value] of Object.entries(input)){if(!(key in defaults))continue;if(typeof defaults[key]==='boolean'){if(typeof value==='boolean')out[key]=value;}else if(typeof value==='string')out[key]=value;}if(!['1','2','3','4'].includes(out.concurrent))out.concurrent='1';if(!['off','15','30','45','60','track'].includes(out.sleep))out.sleep='off';return out;}
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value));fs.renameSync(temp,file);}
function spotifyLink(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='open.spotify.com')return null;const m=u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|playlist|album)\/([a-zA-Z0-9]{22})\/?$/);return m?`https://open.spotify.com/${m[1]}/${m[2]}`:null;}catch{return null;}}
module.exports={defaults,settings,read,write,spotifyLink};
