'use strict'

const request = require('request-promise-native')
  .defaults({ pool: { maxSockets: 10 } });
const extract = require('cheerio');
const BASE = "https://developer.mozilla.org";

// zamyslim sa co idem robit a 
// a) kodnem zoznam funkcii ktore viem ze musim mat
// absolutne ma nezaujima ako ich idem pospajat, 
// ci cez callbacky, promises, then, alebo rx
// vstupy vystupy

const download = (url) => request.get(url); //prevent other args to pass 

const extractLinks = (body) => extract('article', body)
  .find('li > a:nth-child(1)').toArray()
  .map(el => extract(el).attr('href'));

const normalizeLinks = (base) =>
  (links) => links.map(link =>
    !(link.startsWith('https://')) ? `${base}/${link}` : link);

const extractSignature = (body) => ({
  name: extract('h1', body).text(),
  params: extract('#Parameters', body)
    .next('dl')
    .find('dd').toArray()
    .map(el => extract(el).text())
})

const checkParams = (signature) =>
  signature.params.some(looksLikeFunction) ? signature : null;

const looksLikeFunction = (param) => [
   	/^function/i,
   	/Specifies a function/,
   	/^A function/i
   	]
  .some(re => re.test(param))

const save = (s) => console.log(s);

// // B) zacnem ich spajat, vybral som si promises

// // v 90% pripadoch by som nemusel pisat tie lambdy
// // ale ak ich napisem je jasne co su vstupy a vystupy
// //
// download(`${BASE}/bm/docs/Web/JavaScript/Reference/Methods_Index`)
//   .then(body => extractLinks(body))
//   .then(links => normalizeLinks(BASE)(links))
//   .then(links => {
//     links.forEach(link =>
//       download(link)
//       .then(body => extractSignature(body))
//       .then(signature => checkParams(signature))
//       .then(matched => {
//         if (matched)
//           save(matched.name);
//       })
//     );
//   });

// takto by to vyzeralo bez arrows(ani diva svina nevie ako alg funguje)
// ale stale je to o tom ze popisujem ako to robi
download(`${BASE}/bm/docs/Web/JavaScript/Reference/Methods_Index`)
  .then(extractLinks)
  .then((o)=>console.log(JSON.stringify(o,null,2)))

// C) prepisem to tak aby bolo jasne co program robi a nie ako to robi
// toto je samozrejme extrem,
// ale najdolezitejsia je ta cast ako ich odfiltrujes,
// zvysok sa docitam

// apiList()
//   .then(signatures)
//   .then(signatures =>
//     signatures.filter(({ params }) =>
//       params.some(looksLikeFunction)))
//   .then(sort)
//   .then(print);

// D) bordel k tomu zvyzku hore, ale gro funkcii je tam navrchu
function apiList() {
  return download(`${BASE}/bm/docs/Web/JavaScript/Reference/Methods_Index`)
    .then(extractLinks)
    //.then(links => links.filter((a, i) => i < 10))
    .then(normalizeLinks(BASE))
    .then(links => links.map(download))
    .then(docs => Promise.all(docs))
}

function sort(signatures) {
  return signatures.sort(({ name: a }, { name: b }) =>
    a.localeCompare(b)
  );
}

function signatures(docs) {
  return Promise.all(docs)
    .then(docs => docs.map(extractSignature))
}

function filter(byWhat) {
  return function(signatures) {
    return signatures.filter(byWhat);
  }
}

function print(signatures) {
  signatures.forEach(({ name }) => console.log(name));
}