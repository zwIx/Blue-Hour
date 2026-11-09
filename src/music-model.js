(function(root){
  function artists(track){
    const names=(track.artists?.length?track.artists:[track.artist||'Unknown artist']);
    const primary=names.flatMap(name=>String(name).split(/\s*;\s*|,\s+/u)).map(s=>s.trim()).find(Boolean);
    return [primary||'Unknown artist'];
  }
  function pool(tracks,scope){
    if(scope?.type==='album')return tracks.filter(t=>t.album===scope.name&&t.albumArtist===scope.artist).sort((a,b)=>a.number-b.number);
    if(scope?.type==='artist')return tracks.filter(t=>artists(t).includes(scope.name));
    return tracks;
  }
  function next({tracks,scope,current,queue=[],shuffle=false,repeat=false},random=Math.random){
    const choices=pool(tracks,scope);if(!choices.length)return null;
    if(repeat&&choices.some(t=>t.id===current))return current;
    const queued=queue.find(id=>choices.some(t=>t.id===id));if(queued)return queued;
    if(shuffle){const others=choices.filter(t=>t.id!==current);return others.length?others[Math.floor(random()*others.length)].id:choices[0].id;}
    const index=choices.findIndex(t=>t.id===current);
    return choices[index+1]?.id||(scope?choices[0].id:null);
  }
  const model={artists,pool,next};if(typeof module==='object')module.exports=model;else root.musicModel=model;
})(globalThis);
