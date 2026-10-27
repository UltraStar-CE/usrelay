import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('mic, player and lock accents follow exact game colors with readable occupied text',()=>{
 const state={playerColors:['#0000ff','#ff0000','#ffff00',...Array(8).fill('#00ff00'),'#123456']};
 const context=vm.createContext({state});
 vm.runInContext(source.slice(source.indexOf('function applySlotColor('),source.indexOf('function slotLabelText(')),context);
 const values=new Map(); const element={style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
 for(const [slot,color,text] of [[1,'#0000ff','#ffffff'],[2,'#ff0000','#111111'],[3,'#ffff00','#111111'],[12,'#123456','#ffffff']]){
  context.applySlotColor(element,slot);assert.equal(values.get('--room-color'),color);assert.equal(values.get('--occupied-text'),text);
 }
 state.playerColors[1]='#AABBCC';context.applySlotColor(element,2);assert.equal(values.get('--room-color'),'#AABBCC');
 context.applySlotColor(element,0);assert.equal(values.size,0,'lobby must not keep the previous singer color');
 state.playerColors[0]='red; background:url(https://invalid)';context.applySlotColor(element,1);assert.equal(values.size,0);
});
