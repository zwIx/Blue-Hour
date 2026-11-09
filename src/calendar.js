
(()=>{
const root=document.querySelector('.approved-date-hud'),canvas=root.querySelector('canvas'),image=root.querySelector('[data-date-art]');
const motion=document.querySelector('[data-setting=motion]');
const plate=new Image();plate.src='assets/calendar-no-badge.png';
const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
if(!gl){canvas.hidden=true;return;}
const vertex='attribute vec2 point; varying vec2 uv; void main(){uv=(point+1.0)*0.5;gl_Position=vec4(point,0.,1.);}';
const fragment=`precision highp float;
uniform sampler2D art;uniform sampler2D cleanPlate;uniform sampler2D iconArt;uniform float time;uniform float phase;varying vec2 uv;
float inside(vec2 p,vec2 lo,vec2 hi,float f){return smoothstep(lo.x-f,lo.x,p.x)*(1.-smoothstep(hi.x,hi.x+f,p.x))*smoothstep(lo.y-f,lo.y,p.y)*(1.-smoothstep(hi.y,hi.y+f,p.y));}
void main(){vec2 p=vec2(mix(.13,.87,uv.x),mix(phase>.5?.50:0.,phase>.5?.98:.48,1.-uv.y));vec4 original=texture2D(art,p);
float band=inside(p,vec2(.09,.16),vec2(.91,.44),.025)+inside(p,vec2(.09,.66),vec2(.91,.94),.025);
float text=inside(p,vec2(.275,.12),vec2(.52,.43),.018)+inside(p,vec2(.275,.62),vec2(.52,.94),.018);
float icons=inside(p,vec2(.55,.13),vec2(.68,.43),.035)+inside(p,vec2(.55,.64),vec2(.68,.92),.035);
float blue=smoothstep(.06,.18,original.b-original.g)*smoothstep(.05,.16,original.b-original.r);
float movement=band*(1.-clamp(text+icons,0.,1.))*blue;
vec2 q=p;q.y+=movement*.008*(sin(p.x*24.-time*1.1)+.4*sin(p.x*43.+time*.8));q.x+=movement*.0018*sin(p.y*32.+time*.8);
vec4 color=texture2D(art,q);
float yellow=smoothstep(.3,.65,min(original.r,original.g)-original.b);
float day=inside(p,vec2(.55,.13),vec2(.68,.43),.03);float night=inside(p,vec2(.55,.64),vec2(.68,.92),.03);

float starA=inside(p,vec2(.565,.675),vec2(.598,.76),.006);
float starB=inside(p,vec2(.638,.81),vec2(.668,.89),.006);
float twinkle=sin(time*1.7);
float shimmer=1.+yellow*(starA*.38*twinkle-starB*.38*twinkle);
vec3 result=color.rgb*shimmer;
float alpha=smoothstep(.32,.55,max(result.r,max(result.g,result.b)));
vec3 unmatted=(result-vec3(.008,.02,.10)*(1.-alpha))/max(alpha,.001);

// Sample only the text-free original icon, never the live lettering or ribbons.
vec2 center=vec2(.614,.286);
vec2 delta=(p-center)*vec2(3.,1.);
float angle=-time*.20;
vec2 source=center+(mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*delta)/vec2(3.,1.);
vec3 sun=texture2D(iconArt,source).rgb;
float bounds=inside(source,vec2(.548,.115),vec2(.684,.455),.002);
float radius=length((source-center)*vec2(3.,1.));
float noArcs=1.-smoothstep(.126,.133,radius);
float sunAlpha=smoothstep(.02,.24,min(sun.r,sun.g)-sun.b)*bounds*noArcs*(1.-step(.5,phase));
float finalAlpha=sunAlpha+alpha*(1.-sunAlpha);
vec3 finalColor=(sun*sunAlpha+clamp(unmatted,0.,1.)*alpha*(1.-sunAlpha))/max(finalAlpha,.001);
gl_FragColor=vec4(finalColor,finalAlpha);



}`;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const point=gl.getAttribLocation(program,'point');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
let started=false,clock=0,last=performance.now(),lastDraw=0,raf=0,lastDate='';
const time=gl.getUniformLocation(program,'time'),phaseLocation=gl.getUniformLocation(program,'phase');
let artTexture,plateTexture,iconTexture;
const dates=new Map();

// Replace only the prototype's sample lettering, once when the calendar changes.
// The source ribbons, colors, icon artwork, and animation shader remain intact.
function liveArtwork(source,state){
 const out=document.createElement('canvas');out.width=source.naturalWidth;out.height=source.naturalHeight;
 const ctx=out.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
 const {width:w,height:h}=out;
 function text(value,x,y,size,color,width){ctx.save();ctx.font=`900 ${size*h}px Arial`;ctx.fillStyle=color;ctx.translate(x*w,y*h);ctx.scale(width*w/ctx.measureText(value).width,1);ctx.fillText(value,0,0);ctx.restore();}
 for(const row of [0,.5]){
  text(state.date,.282,row+.307,.23,'#ffffff',.15);
  text(state.shortDay,.443,row+.262,.10,'#ffffff',.052);
  text(row?'Evening':'Daytime',.34,row+.397,.11,'#00eeff',.14);
 }
 return out;
}
function upload(unit,texture,source){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
function updateCalendar(){
 const state=blueHourCalendar(),key=JSON.stringify(state);if(key===lastDate)return;lastDate=key;
 gl.uniform1f(phaseLocation,state.night?1:0);
 root.querySelector('[data-live-weekday]').textContent=state.weekday.toUpperCase();
 const dateKey=state.date+state.weekday;
 if(!dates.has(dateKey)){dates.clear();const artwork=liveArtwork(plate,state);dates.set(dateKey,[artwork,artwork]);}
 const art=dates.get(dateKey);upload(0,artTexture,art[0]);upload(1,plateTexture,art[1]);
 root.dataset.period=state.night?'night':'day';root.dataset.weekend=String(state.weekend);
 root.setAttribute('aria-label',`${state.weekday}, ${state.date}, ${state.night?'Evening':'Daytime'}, ${state.weekend?'Weekend':'Weekday'}`);
 root.title=root.getAttribute('aria-label');
 draw();
}
function resize(){const width=Math.min(900,Math.max(360,Math.ceil(root.getBoundingClientRect().width*Math.min(devicePixelRatio,2))));canvas.width=width;canvas.height=Math.round(width/4.625);gl.viewport(0,0,canvas.width,canvas.height);if(started)draw();}
function draw(){gl.uniform1f(time,clock*1.1);gl.drawArrays(gl.TRIANGLES,0,6);}
function active(){return motion.getAttribute('aria-checked')==='true'&&!document.hidden;}
function frame(now){raf=0;if(!active())return;const delta=Math.min((now-last)/1000,.1);last=now;clock+=delta;
 if(now-lastDraw>=1000/60-1){lastDraw=now;draw();}raf=requestAnimationFrame(frame);
}
function resume(){if(!started)return;if(!active()){if(raf)cancelAnimationFrame(raf);raf=0;draw();return;}if(!raf){last=performance.now();raf=requestAnimationFrame(frame);}}
function texture(unit,name){gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const [key,value] of [[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR]])gl.texParameteri(gl.TEXTURE_2D,key,value);gl.uniform1i(gl.getUniformLocation(program,name),unit);return t;}
function start(){if(started||!image.complete||!image.naturalWidth||!plate.complete||!plate.naturalWidth)return;artTexture=texture(0,'art');plateTexture=texture(1,'cleanPlate');iconTexture=texture(2,'iconArt');upload(2,iconTexture,image);resize();started=true;updateCalendar();resume();}
new ResizeObserver(resize).observe(root);new MutationObserver(resume).observe(motion,{attributes:true,attributeFilter:['aria-checked']});document.addEventListener('visibilitychange',resume);
setInterval(()=>{if(started)updateCalendar()},1000);
plate.addEventListener('load',start);image.addEventListener('load',start);if(image.complete&&image.naturalWidth)start();
})();
