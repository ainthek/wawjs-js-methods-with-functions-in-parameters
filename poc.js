const { Parser } = require("htmlparser2");
const { StringDecoder } = require('string_decoder');
const { Transform, Writable } = require('stream');
const request = require("request");

class DownloadStream extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true });
  }
  _transform(o, enc, cb) {
    request.get(o.link, (err, response, data) => {
      this.push({ ...o, data });
      //console.log('done', o.link)
      cb(err);
    })
 //    this.push({ ...o});
	// cb();
  }
}

class ExtractLinks extends Transform {

  constructor(options) {
    super({ ...options, objectMode: true });

    const onopentag = (name, attribs) => {
      if (name === "a" && attribs.href.includes('Reference/Global_Objects')) {
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
const BASE = "https://developer.mozilla.org";
const normalizeLink = (base, link) =>
  !(link.startsWith('https://')) ? `${base}/${link}` : link;

const fs = require("fs");
fs.createReadStream("./index.html", { encoding: "utf8", highWaterMark: 1024 })
  .pipe(new ExtractLinks({ decodeStrings: false }))
  .pipe(new Transform({
    transform(o, e, cb) {
      this.push({ ...o, link: normalizeLink(BASE, o.attribs.href) }),
        cb()
    },
    objectMode: true
  }))
  .pipe(new DownloadStream(
    //{ writableHighWaterMark: 10, readableHighWaterMark: 3000 }
  ))
  .pipe(new Writable({
    objectMode: true,
    write(chunk, encoding, callback) {
      process.stdout.write(JSON.stringify(chunk.link) + "\n", callback);
    }
  }))