import {readFileSync} from 'node:fs';
const paths={"home.html": "ui/home.html", "home.css": "ui/home.css", "home.js": "ui/home.js", "privacy.html": "ui/privacy.html", "icon.svg": "assets/icon.svg", "variant-match.js": "core/variant-match.js", "suggestions.js": "core/suggestions.js", "wishlist.js": "core/wishlist.js", "wishlist-file.js": "core/wishlist-file.js", "price-history.js": "core/price-history.js", "extract.js": "shops/extract.js", "variants.js": "shops/variants.js", "shop.js": "shops/reader.js", "background.js": "core/search-controller.js", "products.js": "core/products.js", "identifiers.js": "core/identifiers.js", "catalog.js": "core/catalog.js"};
export function readSource(name){
 if(['products.js','variant-match.js'].includes(name))return readSource('identifiers.js')+readFileSync(new URL('./src/'+paths[name],import.meta.url),'utf8');
 if(name==='shop.js')return readSource('variant-match.js')+readFileSync(new URL('./src/shops/reader.js',import.meta.url),'utf8');
 if(name==='extract.js')return readSource('products.js')+readFileSync(new URL('./src/shops/extract.js',import.meta.url),'utf8');
 if(name==='background.js')return 'var searchPlatform=platform;\n'+readSource('catalog.js')+readFileSync(new URL('./src/core/search-controller.js',import.meta.url),'utf8');
 return readFileSync(new URL('./src/'+paths[name],import.meta.url),'utf8');
}
