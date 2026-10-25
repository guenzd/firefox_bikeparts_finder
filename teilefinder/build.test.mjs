import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url)),src=path.join(root,'teilefinder/src');
const read=name=>readFileSync(path.join(src,name),'utf8');
const manifest=name=>JSON.parse(readFileSync(path.join(root,'teilefinder/manifests',name+'.json'),'utf8'));
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);

test('Firefox and Chrome manifests share readers, keep the Firefox ID, and isolate their background entry points',()=>{
 const firefox=manifest('firefox'),chrome=manifest('chrome');
 assert.equal(firefox.manifest_version,2);assert.equal(firefox.browser_specific_settings.gecko.id,'r2-teilefinder@local.invalid');
 assert.equal(chrome.manifest_version,3);assert.equal(chrome.browser_specific_settings,undefined);assert.equal(chrome.browser_action,undefined);assert.ok(chrome.action);
 assert.equal(chrome.version,firefox.version);assert.deepEqual(chrome.content_scripts,firefox.content_scripts);
 assert.deepEqual(chrome.host_permissions,firefox.permissions.filter(value=>value.startsWith('https:')));
 assert.ok(!firefox.background.scripts.includes('core/search-controller.js'));assert.equal(chrome.background.service_worker,'platform/chrome-worker.js');
 assert.ok(!/searchAll|jobs=new Map|setInterval/.test(read('platform/background.js')));
 const scripts=[...read('ui/home.html').matchAll(/<script src="\.\.\/([^"]+)"/g)].map(match=>match[1]);
 for(const [before,after] of [['platform/api.js','platform/page.js'],['platform/page.js','core/search-controller.js'],['core/products.js','core/search-controller.js'],['core/variant-match.js','core/search-controller.js'],['core/catalog.js','core/search-controller.js'],['core/search-controller.js','ui/home.js'],['core/price-history.js','data/price-history-store.js'],['data/price-history-store.js','ui/home.js']])assert.ok(scripts.indexOf(before)>=0&&scripts.indexOf(before)<scripts.indexOf(after),before+' before '+after);
 new vm.Script(scripts.map(read).join('\n'));
 new vm.Script(chrome.content_scripts[0].js.map(read).join('\n'));
 assert.equal(chrome.content_scripts[0].js[0],'platform/api.js');assert.equal(chrome.content_scripts[0].js[1],'platform/content.js');
 for(const size of [16,32,48,128]){const icon=readFileSync(path.join(src,chrome.icons[size]));assert.equal(icon.subarray(1,4).toString(),'PNG');assert.equal(icon.readUInt32BE(16),size);assert.equal(icon.readUInt32BE(20),size);}
});

test('Shared sources never access native browser namespaces, and model logic never depends on DOM or extension APIs',()=>{
 for(const file of files(src).filter(file=>file.endsWith('.js')&&!file.includes(path.sep+'platform'+path.sep)))assert.ok(!/\bbrowser\.|\bchrome\.|globalThis\.(?:browser|chrome)/.test(readFileSync(file,'utf8')),file);
 for(const name of ['products.js','variant-match.js','catalog.js','wishlist.js','suggestions.js','price-history.js'])assert.ok(!/\b(?:document|window|platform|searchPlatform|indexedDB)\.[A-Za-z_$]/.test(read('core/'+name)),name);
 assert.ok(read('platform/chrome-worker.js').includes("importScripts('api.js','registry.js','background.js')"));
});

test('Both packages validate all assets, contain identical common sources, and are byte-for-byte reproducible',()=>{
 const output=mkdtempSync(path.join(tmpdir(),'teilefinder-package-test-'));
 try{
  const code=`import importlib.util,pathlib,sys,zipfile\nspec=importlib.util.spec_from_file_location('build',sys.argv[1]);build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)\narchives={}\nfor target in build.TARGETS:\n manifest=build.validate(target);archive=build.write_bundle(target,manifest,pathlib.Path(sys.argv[2]));first=archive.read_bytes();build.write_bundle(target,manifest,pathlib.Path(sys.argv[2]));assert first==archive.read_bytes();archives[target]=archive\nwith zipfile.ZipFile(archives['firefox']) as ff,zipfile.ZipFile(archives['chrome']) as chrome:\n assert set(ff.namelist())==set(chrome.namelist())\n for name in ff.namelist():\n  if name!='manifest.json':assert ff.read(name)==chrome.read(name),name\n`;
  const result=spawnSync('python3',['-B','-c',code,path.join(root,'scripts/build-extension.py'),output],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
 }finally{rmSync(output,{recursive:true,force:true});}
});
