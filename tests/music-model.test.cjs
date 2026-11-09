const {test}=require('node:test');const assert=require('node:assert/strict');const model=require('../src/music-model.js');
const tracks=[{id:'a',album:'One',albumArtist:'A',artist:'A',number:1},{id:'b',album:'One',albumArtist:'A',artist:'A, B',artists:['A, B'],number:2},{id:'c',album:'Two',albumArtist:'C',artist:'C',number:1}];
test('album loops in order and excludes outside queued tracks in shuffle',()=>{const scope={type:'album',name:'One',artist:'A'};assert.equal(model.next({tracks,scope,current:'b',queue:['c']}),'a');for(let i=0;i<100;i++)assert.ok(['a','b'].includes(model.next({tracks,scope,current:'a',queue:['c'],shuffle:true})));});
test('collaborations appear only under their main credited artist',()=>{
 assert.deepEqual(model.artists(tracks[1]),['A']);
 assert.deepEqual(model.pool(tracks,{type:'artist',name:'B'}),[]);
 assert.deepEqual(model.pool(tracks,{type:'artist',name:'A'}).map(t=>t.id),['a','b']);
 assert.equal(model.next({tracks,scope:{type:'artist',name:'A'},current:'b',queue:['c']}),'a');
 assert.deepEqual(model.artists({artists:['Nujabes','Cise Starr & Akin from CYNE']}),['Nujabes']);
});
