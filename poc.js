const request = require("request-promise-native");
const extract = require('cheerio');

// ---------------------------------------------------------------
// normal methods
const BASE = "https://developer.mozilla.org";
const download = (url) => request.get(url); //prevent other args to pass 
const normalizeLink = (base, link) =>
  !(link.startsWith('https://')) ? `${base}/${link}` : link;

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
//----------------------------------------------------------------  
const { Parser } = require("htmlparser2");
const { StringDecoder } = require('string_decoder');
const { Transform, Writable } = require('stream');

// wrappers for streaming processing
class ExtractLinks extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true, decodeStrings: false });

    const onopentag = (name, attribs) => {
      if (name === "a" && attribs.href.includes('Reference/Global_Objects/Array/f')) {
        var b = this.push({ name, attribs });
        console.log(b);
      }
    };
    this._parser = new Parser({ onopentag });
    this._decoder = new StringDecoder();

    this.once("finish", () => {
      this._parser.end(this._decoder.end())
    });
  }
  _transform(chunk, enc, cb) {
    //console.log(chunk);
    if (chunk instanceof Buffer) chunk = this._decoder.write(chunk);
    this._parser.write(chunk);
    cb();
  }
}
const normalizeLinks = (base) => new Transform({
  transform(o, e, cb) {
    this.push({ ...o, link: normalizeLink(base, o.attribs.href) });
    cb()
  },
  objectMode: true
});

class Download extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true });
  }
  _transform(o, enc, cb) {
    download(o.link).then((data) => {
      this.push({ ...o, data });
      cb();
    }, cb);
  }
}
class ExtractSignature extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true });
  }
  _transform(o, enc, cb) {
    this.push({
      ...o,
      signature: extractSignature(o.data)
    });
    cb();
  }
}
class CheckParams extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true });
  }
  _transform(o, enc, cb) {
    if (checkParams(o.signature))
      this.push(o);
    cb();
  }
}


class Save extends Writable {
  constructor(fn) {
    super({ objectMode: true });
    this.fn = fn
  }
  _write(o, enc, cb) {
    save(this.fn(o));
    cb();
  }
}
// ---------------------------------------------------------------
// final algorithm
// download(`${BASE}/bm/docs/Web/JavaScript/Reference/Methods_Index`)
//   .pipe(new ExtractLinks()) //streams objects { name, attribs }
//   .pipe(normalizeLinks(BASE)) // { name, attribs, link }
//   .pipe(new Download()) // { name, attribs, link, data }
//   .pipe(new ExtractSignature()) // { name, attribs, link, data, signature }
//   .pipe(new CheckParams()) // // filter, { name, attribs, link, data, signature }
//   .pipe(new Save(o => o.signature.name));


function map(fn) {
  return new Transform({
    transform(o, e, cb) {
      this.push(fn(o));
      cb();
    },
    objectMode: true
  });
}

download(`${BASE}/bm/docs/Web/JavaScript/Reference/Methods_Index`)
  .pipe(new ExtractLinks()) //streams objects { name, attribs }
  .pipe(map((o) => ({ ...o, link: normalizeLink(BASE, o.attribs.href) }))) // { name, attribs, link }
  .pipe(new Download()) // { name, attribs, link, data }
  .pipe(new ExtractSignature()) // { name, attribs, link, data, signature }
  .pipe(new CheckParams()) // // filter, { name, attribs, link, data, signature }
  .pipe(new Save(o => o.signature.name));

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