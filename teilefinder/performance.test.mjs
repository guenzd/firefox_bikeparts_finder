import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {profileSearch} from '../scripts/profile-search.mjs';

test('Ready listings avoid the redundant two-second stability wait without extra navigations or reads',async()=>{
 const result=await profileSearch();assert.equal(result.elapsedMs,2500);assert.equal(result.listingReads,8);assert.equal(result.navigations,4);assert.equal(result.createdTabs,4);assert.equal(result.maxInFlightPerTab,1);
 assert.equal(result.phases.length,1);assert.equal(result.phases[0].shops.bike24.wait.ms,2500);
});
test('Delayed listings still wait for real results; saved product pages skip listing searches',async()=>{
 const delayed=await profileSearch({loadMs:2500});assert.equal(delayed.elapsedMs,4500);assert.equal(delayed.listingReads,12);
 const saved=await profileSearch({cached:true});assert.equal(saved.elapsedMs,750);assert.equal(saved.listingReads,0);assert.equal(saved.detailReads,4);
});
test('Repeated checks reuse exactly four shop tabs, serialise each tab and bound local profiling history',async()=>{
 const result=await profileSearch({cached:true,runs:22});assert.equal(result.createdTabs,4);assert.equal(result.navigations,88);assert.equal(result.maxInFlightPerTab,1);assert.equal(result.phases.length,20);
 assert.doesNotMatch(JSON.stringify(result.phases),/1234567890128|Example Model|https:/);
});
test('Content retries share the in-progress DOM read; different requests queue and failures release the queue',async()=>{
 const ctx=vm.createContext({});const reader=readFileSync(new URL('./src/shops/reader.js',import.meta.url),'utf8');vm.runInContext(reader.split('platform.runtime.onMessage')[0],ctx);
 const started=[],release=[];let active=0,max=0;
 const queue=ctx.createShopReadQueue(async data=>{started.push(data.query);active++;max=Math.max(max,active);try{await new Promise(resolve=>release.push(resolve));if(data.query==='fail')throw Error('Read failed');return data.query;}finally{active--;}});
 const first=queue({type:'detail',query:'first'}),duplicate=queue({type:'detail',query:'first'}),second=queue({type:'extract',query:'second'});
 assert.equal(first,duplicate);await new Promise(setImmediate);assert.deepEqual(started,['first']);release.shift()();assert.equal(await first,'first');await new Promise(setImmediate);assert.deepEqual(started,['first','second']);release.shift()();assert.equal(await second,'second');assert.equal(max,1);
 const failed=queue({type:'detail',query:'fail'});await new Promise(setImmediate);const rejection=assert.rejects(failed,/Read failed/);release.shift()();await rejection;
 const retry=queue({type:'detail',query:'first'});await new Promise(setImmediate);release.shift()();assert.equal(await retry,'first');assert.equal(queue({type:'other'}),undefined);
});
test('Security-check retries keep their slower interval and use the same four tabs',async()=>{
 const result=await profileSearch({blockedReads:2});assert.equal(result.minBlockedRetryMs,2000);assert.equal(result.elapsedMs,6500);assert.equal(result.createdTabs,4);assert.equal(result.maxInFlightPerTab,1);
});
test('Cancelled linked-variant checks stop after the pending wait instead of issuing more detail reads',async()=>{
 let active=true,reads=0;const ctx=vm.createContext({URL,jobActive:()=>active,async navigateShop(){},async shopPause(){active=false;},async shopMessage(){reads++;return {ready:false};}});
 const source=readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');vm.runInContext(source.slice(source.indexOf('async function bike24Linked(')),ctx);
 await ctx.bike24Linked({id:1},{id:'bike24',host:'www.bike24.de'},{query:'Example product'},{},{offers:[],linkedVariants:[{url:'https://www.bike24.de/p1.html'}]});assert.equal(reads,0);
});
