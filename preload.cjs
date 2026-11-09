const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('blueHour',{
 call:(method,...args)=>ipcRenderer.invoke('bluehour',method,...args),
 notchControl:action=>ipcRenderer.send('notch-control',action),
 on:(channel,callback)=>{if(!['library','downloads','control','error','notch-state','notch-displays'].includes(channel))return;const fn=(_,value)=>callback(value);ipcRenderer.on(channel,fn);return()=>ipcRenderer.removeListener(channel,fn)}
});
