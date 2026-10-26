import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source = readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('an available mic can be selected before microphone permission, while occupied slots stay protected', () => {
  let click;
  const selected=[];
  const button={disabled:false,dataset:{slot:'1'}};
  const context=vm.createContext({
    micRoomsUnlocked:()=>false,
    micRoomList:{addEventListener(_type,handler){click=handler;},contains:()=>true},
    sendSlotProfile:(slot)=>selected.push(slot)
  });
  const start=source.indexOf("micRoomList?.addEventListener('click'");
  vm.runInContext(source.slice(start,source.indexOf('for (const [input, key]',start)),context);
  const event={target:{closest:()=>button},preventDefault(){}};
  click(event); assert.deepEqual(selected,[1]);
  button.disabled=true; click(event); assert.deepEqual(selected,[1]);
});
