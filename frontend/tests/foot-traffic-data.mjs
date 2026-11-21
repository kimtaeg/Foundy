import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function loadModule(file, extras = {}) {
  const source=readFileSync(file,'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports={};
  vm.runInNewContext(output,{exports,...extras},{filename:file});
  return exports;
}
const {cellStat}=loadModule('src/lib/foot-traffic/population.ts');
const pop=values=>[{type:'local',ymd:'20261115',values:{cell:values}}];
const plain=value=>JSON.parse(JSON.stringify(value));
const results=[];
function test(name, fn){ fn();results.push({name,status:'passed'}); }
test('masked hours excluded from daily denominator',()=>assert.deepEqual(plain(cellStat(pop([10,'*',30,null]),'cell','avg')),{sum:20,observed:true,suppressed:1,observedHours:2,presentHours:3}));
test('public zero contributes an observed hour',()=>assert.deepEqual(plain(cellStat(pop([0,10]),'cell','avg')),{sum:5,observed:true,suppressed:0,observedHours:2,presentHours:2}));
test('fully suppressed is not public zero',()=>assert.deepEqual(plain(cellStat(pop(['*','*']),'cell','avg')),{sum:0,observed:false,suppressed:2,observedHours:0,presentHours:2}));
test('missing cells remain missing',()=>assert.equal(cellStat(pop([null,null]),'cell','avg'),null));
test('partial tuples retain suppression and observed value',()=>assert.deepEqual(plain(cellStat(pop([[20,2,3]]),'cell',0)),{sum:20,observed:true,suppressed:3,observedHours:1,presentHours:1}));
test('no observed rows tuple stays masked',()=>assert.equal(cellStat(pop([[0,0,2]]),'cell',0).observed,false));
test('all population groups aggregate public sums only',()=>assert.deepEqual(plain(cellStat([...pop([10]),{type:'fornLong',ymd:'20261115',values:{cell:['*']}},{type:'fornTemp',ymd:'20261115',values:{cell:[5]}}],'cell',0)),{sum:15,observed:true,suppressed:1,observedHours:1,presentHours:1}));
test('invalid hours are missing',()=>{assert.equal(cellStat(pop([10]),'cell',24),null);assert.equal(cellStat(pop([10]),'cell',-1),null);});
let fetchCalls=0;
const urls=[];
const loader=loadModule('src/lib/foot-traffic/data-loader.ts',{fetch:async url=>{urls.push(url);fetchCalls++;return fetchCalls===1?{ok:false,status:503}:{ok:true,status:200,json:async()=>pop([10])[0]};}});
await assert.rejects(loader.loadPop('local'));
await loader.loadPop('local');
await loader.loadPop('local');
assert.equal(fetchCalls,2);
assert.ok(urls.every(url=>url.startsWith('/data/foot-traffic/')));
results.push({name:'rejected population fetch evicted and successful fetch cached',status:'passed'});
const qualityLoader=loadModule('src/lib/foot-traffic/data-loader.ts',{fetch:async()=>({ok:false,status:503})});
await assert.rejects(qualityLoader.loadQuality());
results.push({name:'quality HTTP failure propagates',status:'passed'});
console.log(JSON.stringify({passed:results.length,results},null,2));
