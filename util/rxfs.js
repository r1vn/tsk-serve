#!/usr/bin/env node

'use strict' // 2021-04-12 23.42

const fs = require('fs')
const http = require('http')
const path = require('path')

// util

/**
interprets `-` and `--` as prefixes for key-value or boolean true options, `---` as boolean false option prefix<br>
strings without dash prefixes are considered to be arguments<br>
order doesn't matter
@example
xdArgvParse(['arg1', '-opt1', '--opt2', '-opt3=foo', '--opt4=bar baz', '---opt5', 'arg2'])
 // {
 //  args: [ 'arg1', 'arg2' ],
 //  opts: { opt1: true, opt2: true, opt3: 'foo', opt4: 'bar baz', opt5: false }
 // }
*/

function xdArgvParse(argv) {
    const args = [];
    const opts = {};
    for (let str of argv) {
        if (!str.startsWith('-')) {
            args.push(str);
        }
        else if (str.startsWith('---')) {
            opts[str.slice(3)] = false;
        }
        else {
            str = str.replace(/^-+/, '');
            if (str.indexOf('=') === -1) {
                opts[str] = true;
            }
            else {
                const key = str.slice(0, str.indexOf('='));
                const val = str.slice(str.indexOf('=') + 1);
                opts[key] = val;
            }
        }
    }
    return { args, opts };
}

{
    /**
    formats a `Date` object into a string according to the specified format.<br>
    tokens:<br>
    `{yy}` - year  <br>
    `{yyyy}` - full year  <br>
    `{M}` - month 1-12 <br>
    `{MM}` - month 01-12 (0-padded)  <br>
    `{mon}` / `{Mon}` / `{MON}` - truncated month name - jan / Jan / JAN  <br>
    `{month}` / `{Month}` / `{MONTH}` - full month name - january / January / JANUARY  <br>
    `{d}` - day, 1-31  <br>
    `{dd}` - day, 01-31  <br>
    `{h24}` - 24h hour 0-23  <br>
    `{hh24}` - 24h hour 00-23  <br>
    `{h12}` - 12h hour 1-12    <br>
    `{hh12}` - 12h hour 01-12  <br>
    `{m}` - minutes 0-59  <br>
    `{mm}` - minutes 00-59  <br>
    `{s}` - seconds, 0-59  <br>
    `{ss}` - seconds, 00-59  <br>
    `{ms}` - miliseconds, 0-999  <br>
    `{msmsms}` - miliseconds, 000-999  <br>
    `{weekday}` / `{Weekday}` / `{WEEKDAY}` - full weekday, e.g. saturday / Saturday / SATURDAY  <br>
    `{wday}` / `{Wday}` / `{WDAY}` - truncated weekday, e.g. sat / Sat / SAT  <br>
    `{p}` / `{P}` - time period, am / pm or AM / PM
    `{tzs}` - timezone offset +/- <br>
    `{tzh}` / `{tzhh}` - timezone offset hours <br>
    `{tzm}` / `{tzmm}` - timezone offset minutes
    @example
    xdDatetimeFormat(new Date(), '{yyyy}-{MM}-{dd}T{hh24}:{mm}:{ss}.{msmsms}{tzs}{tzhh}:{tzmm}') // 2020-10-15T13:37:00.000+01:00
    xdDatetimeFormat(new Date(), '{MM}-{dd}-{yyyy} ({Wday}) {h12}:{mm} {P}')                     // 10-15-2020 (Sun) 1:37 PM
    */

    const funTokens = {
        '{yy}': (date) => date.getFullYear().toString().slice(2),
        '{yyyy}': (date) => date.getFullYear().toString(),
        '{M}': (date) => (date.getMonth() + 1).toString(),
        '{MM}': (date) => (date.getMonth() + 1).toString().padStart(2, '0'),
        '{d}': (date) => date.getDate().toString(),
        '{dd}': (date) => date.getDate().toString().padStart(2, '0'),
        '{h24}': (date) => date.getHours().toString(),
        '{hh24}': (date) => date.getHours().toString().padStart(2, '0'),
        '{h12}': (date) => [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11][date.getHours()].toString(),
        '{hh12}': (date) => [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11][date.getHours()].toString().padStart(2, '0'),
        '{m}': (date) => date.getMinutes().toString(),
        '{mm}': (date) => date.getMinutes().toString().padStart(2, '0'),
        '{s}': (date) => date.getSeconds().toString(),
        '{ss}': (date) => date.getSeconds().toString().padStart(2, '0'),
        '{ms}': (date) => date.getMilliseconds().toString(),
        '{msmsms}': (date) => date.getMilliseconds().toString().padStart(3, '0'),
        '{p}': (date) => date.getHours() < 12 ? 'am' : 'pm',
        '{mon}': (date) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][date.getMonth()],
        '{month}': (date) => ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][date.getMonth()],
        '{wday}': (date) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][date.getDay()],
        '{weekday}': (date) => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][date.getDay()],
        '{tzs}': (date) => date.getTimezoneOffset() > 0 ? '-' : '+',
        '{tzh}': (date) => (Math.floor(Math.abs(date.getTimezoneOffset()) / 60)).toString(),
        '{tzhh}': (date) => (Math.floor(Math.abs(date.getTimezoneOffset()) / 60)).toString().padStart(2, '0'),
        '{tzm}': (date) => (Math.abs(date.getTimezoneOffset()) % 60).toString(),
        '{tzmm}': (date) => (Math.abs(date.getTimezoneOffset()) % 60).toString().padStart(2, '0')
    }

    var xdDatetimeFormat = function (date, format) {
        const formatTokens = format.match(/{.*?}/g);
        if (!formatTokens) {
            throw new Error(`no tokens in the format string: ${format}`);
        }
        let output = format;
        for (const token of formatTokens) {
            if (funTokens[token]) {
                output = output.replace(token, funTokens[token](date));
            }
            else if (funTokens[token.toLowerCase()]) {
                let out = funTokens[token.toLowerCase()](date);
                if (token === token.toUpperCase()) {
                    out = out.toUpperCase();
                }
                else {
                    out = out[0].toUpperCase() + out.slice(1);
                }
                output = output.replace(token, out);
            }
            else {
                throw new Error(`unrecognized token in the format string: ${token}`);
            }
        }
        return output;
    }
}

// nginx 1.14.0 /etc/nginx/mime.types
// verbatim
const mimes =
{
    "3gp": "video/3gpp",
    "3gpp": "video/3gpp",
    "7z": "application/x-7z-compressed",
    "ai": "application/postscript",
    "asf": "video/x-ms-asf",
    "asx": "video/x-ms-asf",
    "atom": "application/atom+xml",
    "avi": "video/x-msvideo",
    "bin": "application/octet-stream",
    "bmp": "image/x-ms-bmp",
    "cco": "application/x-cocoa",
    "crt": "application/x-x509-ca-cert",
    "css": "text/css",
    "deb": "application/octet-stream",
    "der": "application/x-x509-ca-cert",
    "dll": "application/octet-stream",
    "dmg": "application/octet-stream",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ear": "application/java-archive",
    "eot": "application/vnd.ms-fontobject",
    "eps": "application/postscript",
    "exe": "application/octet-stream",
    "flv": "video/x-flv",
    "gif": "image/gif",
    "hqx": "application/mac-binhex40",
    "htc": "text/x-component",
    "htm": "text/html",
    "html": "text/html",
    "ico": "image/x-icon",
    "img": "application/octet-stream",
    "iso": "application/octet-stream",
    "jad": "text/vnd.sun.j2me.app-descriptor",
    "jar": "application/java-archive",
    "jardiff": "application/x-java-archive-diff",
    "jng": "image/x-jng",
    "jnlp": "application/x-java-jnlp-file",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "js": "application/javascript",
    "json": "application/json",
    "kar": "audio/midi",
    "kml": "application/vnd.google-earth.kml+xml",
    "kmz": "application/vnd.google-earth.kmz",
    "m3u8": "application/vnd.apple.mpegurl",
    "m4a": "audio/x-m4a",
    "m4v": "video/x-m4v",
    "mid": "audio/midi",
    "midi": "audio/midi",
    "mml": "text/mathml",
    "mng": "video/x-mng",
    "mov": "video/quicktime",
    "mp3": "audio/mpeg",
    "mp4": "video/mp4",
    "mpeg": "video/mpeg",
    "mpg": "video/mpeg",
    "msi": "application/octet-stream",
    "msm": "application/octet-stream",
    "msp": "application/octet-stream",
    "ogg": "audio/ogg",
    "pdb": "application/x-pilot",
    "pdf": "application/pdf",
    "pem": "application/x-x509-ca-cert",
    "pl": "application/x-perl",
    "pm": "application/x-perl",
    "png": "image/png",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "prc": "application/x-pilot",
    "ps": "application/postscript",
    "ra": "audio/x-realaudio",
    "rar": "application/x-rar-compressed",
    "rpm": "application/x-redhat-package-manager",
    "rss": "application/rss+xml",
    "rtf": "application/rtf",
    "run": "application/x-makeself",
    "sea": "application/x-sea",
    "shtml": "text/html",
    "sit": "application/x-stuffit",
    "svg": "image/svg+xml",
    "svgz": "image/svg+xml",
    "swf": "application/x-shockwave-flash",
    "tcl": "application/x-tcl",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "tk": "application/x-tcl",
    "ts": "video/mp2t",
    "txt": "text/plain",
    "war": "application/java-archive",
    "wbmp": "image/vnd.wap.wbmp",
    "webm": "video/webm",
    "webp": "image/webp",
    "wml": "text/vnd.wap.wml",
    "wmlc": "application/vnd.wap.wmlc",
    "wmv": "video/x-ms-wmv",
    "woff": "application/font-woff",
    "xhtml": "application/xhtml+xml",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xml": "text/xml",
    "xpi": "application/x-xpinstall",
    "xspf": "application/xspf+xml",
    "zip": "application/zip"
}
// additions and overrides
mimes['js'] = 'text/javascript' // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#textjavascript
mimes['log'] = 'text/plain'

// rxfs

class Config
{
    root = '.'
    port = 1234
    baseurl = '/'
    autoindex = false
    servedir = true
    headers = { 'cache-control': `public, max-age=604800, immutable` }
    mimes = {}
    logfile = ''
    verbose = true
    debug = false

    constructor (opts)
    {
        // bulk runtime typecheck and merger of partials with defaults

        for (const key in opts)
        {
            if (!this.hasOwnProperty(key))
            {
                throw new Error(`unrecognized option: ${ key }`)
            }

            if (typeof opts[key] !== typeof this[key])
            {
                throw new Error(`config.${ key } type error: expected a ${ typeof this[key] }, got ${ typeof opts[key] }`)
            }

            this[key] = opts[key]
        }

        // root

        if (!this.root) throw new Error(`config.root can't be an empty string`)
        this.root = path.resolve(this.root)
        if (process.platform === 'win32') this.root = this.root.replace(/\\/g, '/')

        // logfile

        if (this.logfile)
        {
            this.logfile = path.resolve(this.logfile)
            if (process.platform === 'win32') this.logfile = this.logfile.replace(/\\/g, '/')
        }

        // port

        if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535)
        {
            throw new Error(`invalid port specified: ${ this.port }`)
        }

        // baseurl

        this.baseurl = this.baseurl.replace(/\/{2,}/g, '/').replace(/^\//g, '').replace(/\/$/g, '')

        // autoindex / servedir

        if (this.autoindex && this.servedir)
        {
            throw new Error(`config.autoindex and config.servedir are mutally exclusive`)
        }

        // headers / mimes

        for (const prop of ['headers', 'mimes'])
        {
            for (const val of Object.values(this[prop]))
            {
                if (typeof val !== 'string')
                {
                    throw new Error(`config.${ prop } values must be strings`)
                }
            }
        }
    }
}

class R
{
    id
    req
    res
    headers
    rel // relative path of the item in config.root. no leading or trailing slashes
    abs // absolute path of the item

    constructor (rxfs, req, res, id)
    {
        this.id  = id
        this.req = req
        this.res = res

        this.headers = {}
        for (const key in rxfs.config.headers) this.headers[key] = rxfs.config.headers[key]

        let url = req.url
        try { url = decodeURIComponent(url) } catch {}
        this.rel = url.replace(rxfs.config.baseurl, '').replace(/\/{2,}/g, '/').replace(/^\//g, '').replace(/\/$/g, '')
        this.abs = this.rel ? `${ rxfs.config.root }/${ this.rel }` : rxfs.config.root
        if (this.abs.startsWith('//')) this.abs = this.abs.slice(1) // edge case when serving /

        if (rxfs.config.autoindex && fs.existsSync(`${ this.abs }/index.html`))
        {
            this.rel = this.rel ? `${ this.rel }/index.html` : 'index.html'
            this.abs = `${ this.abs }/index.html`
        }
    }
}

class RXFS
{
    root
    config
    server
    logfile
    reqcount = 0

    /** @param {Object.<string, *>} opts */

    constructor (opts = {})
    {
        this.config = new Config(opts)
        this.debug(this.config)

        if (!fs.existsSync(this.config.root)) throw new Error(`no such directory: ${ this.config.root }`)
        if (!fs.statSync(this.config.root).isDirectory()) throw new Error(`not a directory: ${ this.config.root }`)

        if (this.config.logfile)
        {
            try
            {
                fs.mkdirSync(path.parse(this.config.logfile).dir, { recursive: true })
                this.logfile = fs.createWriteStream(this.config.logfile)
            }
            catch (err)
            {
                throw new Error(`failed to create log file: ${ this.config.logfile }: ${ err.message || err }`)
            }
        }

        this.server = http.createServer()
        this.server.listen(this.config.port)
        this.server.addListener('request', this.handle)
        this.log(`dir: ${ this.config.root }`)
        this.log(`url: http://localhost:${ this.config.port }` + (this.config.baseurl === '/' ? '' : '/' + this.config.baseurl))
    }

    handle = (req, res) =>
    {
        const id = (this.reqcount++).toString().padStart(3, '0')
        this.log(`REQ #${ id } ${ req.method } ${ req.url }`)
        const r = new R(this, req, res, id)
        this.debug(`url: ${ r.req.url }\nrel: ${ r.rel }\nabs: ${ r.abs }`)

        // 405

        if (req.method !== 'GET')
        {
            this.sendStatus(r, 405, `method not allowed: ${ req.method }`)
            return
        }

        // 404 #1

        if (!req.url.startsWith(`/${ this.config.baseurl }`) &&
            req.url !== `/${ this.config.baseurl }/`)
        {
            this.sendStatus(r, 404, `not found`)
            return
        }

        //

        let stats
        try
        {
            stats = fs.statSync(r.abs)
        }
        catch (err)
        {
            if (err.code === 'ENOENT')
            {
                this.sendStatus(r, 404, 'not found')
            }
            else
            {
                this.sendStatus(r, 500, err.message)
            }

            return
        }

        if (stats.isFile())
        {
            this.sendFile(r)
        }
        else if (stats.isDirectory())
        {
            if (this.config.servedir)
            {
                this.sendDir(r)
            }
            else
            {
                this.sendStatus(r, 400, 'the server is not configured to serve directories')
            }
        }
        else
        {
            this.sendStatus(r, 400, 'the requested item is not a file or directory')
        }
    }

    sendStatus (r, code, msg)
    {
        this.log(`RES #${ r.id } [status] ${ code } ${ msg }`)
        r.headers['content-type'] = 'text/plain'
        r.res.writeHead(code, r.headers)
        r.res.end(`${ code } : ${ msg }`)
    }

    sendFile (r)
    {
        const ext = path.parse(r.abs).ext.slice(1).toLowerCase()
        r.headers['content-type'] = this.config.mimes[ext] || mimes[ext] || `application/octet-stream`
        r.res.writeHead(200, r.headers)

        const stream = fs.createReadStream(r.abs)

        stream.on('data', chunk => r.res.write(chunk))

        stream.on('error', err => // example: /proc/1/attr/apparmor/exec
        {
            r.res.end()
            this.debug(err)
            this.log(`RES #${ r.id } [file] error: ${ err.message || err }`)
        })

        stream.on('end', () =>
        {
            r.res.end()
            this.log(`RES #${ r.id } [file] OK`)
        })
    }

    sendDir (r)
    {
        const items = []

        for (const dirent of fs.readdirSync(r.abs, { withFileTypes: true }))
        {
            if (dirent.isFile() || dirent.isDirectory())
            {
                const stat = fs.statSync(`${ r.abs }/${ dirent.name }`)

                if (dirent.isFile())
                {
                    items.push({ type: 'file', name: dirent.name, size: stat.size, time: stat.ctime.toISOString() })
                }
                else if (dirent.isDirectory())
                {
                    let size
                    try
                    {
                        size = fs.readdirSync(`${ r.abs }/${ dirent.name }`).length
                    }
                    catch (err)
                    {
                        size = 'N/A'
                    }

                    items.push({ type: 'dir', name: dirent.name, size, time: stat.ctime.toISOString() })
                }
            }
            else
            {
                items.push({ type: 'etc', name: dirent.name })
            }
        }

        r.headers['content-type'] = 'text/html'
        r.res.writeHead(200, r.headers)
        r.res.end(dirview(this.config, r.rel, items))
        this.log(`RES #${ r.id } [dir] OK`)
    }

    /** @param {string} msg */

    log (msg)
    {
        const d = new Date()
        if (this.config.verbose) console.log(`${ xdDatetimeFormat(d, `{hh24}:{mm}:{ss}.{msmsms}`) } ${ msg }`)
        if (this.logfile) this.logfile.write(`${ xdDatetimeFormat(d, `{yyyy}-{MM}-{dd} {hh24}:{mm}:{ss}.{msmsms} ({tzs}{tzhh}:{tzmm})`) } ${ msg }\n`)
    }

    /** @param {*} msg */

    debug (msg)
    {
        if (this.config.debug) console.log(msg)
    }
}

// dirview

const formatBytes = function (b)
{
    if (b < 1024)
    {
        return b + ' B'
    }
    else if (b < 1024 * 1024)
    {
        return (b / 1024).toFixed(2) + ' K' // kib
    }
    else if (b < 1024 * 1024 * 1024)
    {
        return (b / 1024 / 1024).toFixed(2) + ' M' // mib
    }
    else
    {
        return (b / 1024 / 1024 / 1024).toFixed(2) + ' G' // gib
    }
}

const formatDate = function (d)
{
    if (typeof d === 'string') d = new Date(d)
    return xdDatetimeFormat(d, `{yyyy}-{MM}-{dd} {hh24}:{mm}:{ss} ({tzs}{tzhh}:{tzmm})`)
}

function dirview (config, relpath, items)
{
    const root = config.root
    const base = config.baseurl ? `http://localhost:${ config.port }/${ config.baseurl }` : `http://localhost:${ config.port }`

    // breadcrumbs

    let breadcrumbs = `<a href="${ base }">${ root }</a>`

    if (relpath)
    {
        const split = relpath.split('/')
        for (let i = 0; i < split.length; i++)
        {
            const href = `${ base }/${ split.slice(0, i + 1).join('/') }`
            const text = (root === '/' && i === 0) ? split[i] : '/' + split[i]
            breadcrumbs += `<a href="${ href }">${ text }</a>`
        }
    }

    breadcrumbs = `<div class="breadcrumbs">${ breadcrumbs }</div>`

    // table

    // up
    let up = ''
    if (relpath)
    {
        const href = base + (relpath.indexOf('/') !== -1 ? `/${ relpath.slice(0, relpath.lastIndexOf('/')) }` : '')
        up = `<tr><td colspan="3" class="name"><a href="${ href }">..</a></td></tr>`
    }

    // items
    let dirs = ``
    let files = ``
    let etc = ``

    for (const item of items)
    {
        const href = base + (relpath ? `/${ relpath }/${ item.name }` : `/${ item.name }`)

        if (item.type === 'dir')
        {
            if (item.size !== 'N/A')
            {
                dirs += `
                <tr>
                    <td class="bold">
                        <a href="${ href }">${ item.name }</a>
                    </td>
                    <td class="bold">
                        <a href="${ href }">${ item.size }</a>
                    </td>
                    <td class="bold">
                        <a href="${ href }">${ formatDate(item.time) }</a>
                    </td>
                </tr>`
            }
            else
            {
                dirs += `
                <tr>
                    <td class="bold gray">
                        ${ item.name }
                    </td>
                    <td class="bold gray">
                        ${ item.size }
                    </td>
                    <td class="bold gray">
                        ${ formatDate(item.time) }
                    </td>
                </tr>`
            }
        }
        else if (item.type === 'file')
        {
            files += `
            <tr>
                <td class="name">
                    <a class="file" href="${ href }">${ item.name }</a>
                </td>
                <td>
                    <a class="file" href="${ href }">${ formatBytes(item.size) }</a>
                </td>
                <td class="date">
                    <a class="file date" href="${ href }">${ formatDate(item.time) }
                </td>
            </tr>`
        }
        else
        {
            // TODO
        }
    }

    //

    return `\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${ relpath || '/' }</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background-color: #ededed;
            font-family: monospace;
            font-size: 1.25em;
        }
        
        .main {
            display: flex;
            flex-flow: column nowrap;
            max-width: 1280px;
            margin: 0 auto;
        }
        
        a {
            text-decoration: none;
            color: rgb(50, 50, 50);
        }
        
        hr {
            margin: 0 0 15px 0;
            height: 1px;
            color: rgba(129,129,129,0.5);
        }
        
        .breadcrumbs {
            margin: 15px 0;
            line-height: 20px;
        }
        
        .breadcrumbs a, .breadcrumbs span {
            color: rgba(129,129,129,0.5);
        }
        
        .breadcrumbs a:hover, .breadcrumbs a:last-child {
            color: rgb(50, 50, 50);
        }
        
        table {
            /*border: 1px solid #333;*/
            width: 100%;
            max-width: 1280px;
            border-spacing: 0;
            margin-bottom: 50px;
        }
        
        tr {
            /*border-top: 1px solid #333;*/
        }
        
        tr:nth-child(even) {
            background-color: #e5e5e5;
        }
        
        tr:hover {
            background-color: #fff;
        }
        
        td {
            text-align: left;
            padding: 0;
            white-space:nowrap;
        }
        
        td:first-child {
            width: 100%;
        }
        
        td:nth-child(2n) {
            padding-right: 15px;
            text-align: right;
        }
        
        td:nth-child(3n) {
            text-align: right;
        }
        
        td a {
            display: block;
            width: 100%;
            /*padding-right: 50px;*/
        }
        
        .bold {
            font-weight: bold;
        }
        
        .gray {
            color: rgba(129,129,129,0.5);
        }
    </style>
</head>
<body>

    <div class="main">
        ${ breadcrumbs }
        <hr>
        <table>
            <tbody>
                ${ up }
                ${ dirs }
                ${ files }
                ${ etc }
            </tbody>
        </table>   
    </div>
     
</body>
</html>`
}

exports.RXFS = RXFS

// standalone

if (require.main === module)
{
    // maybe init

    if (process.argv.includes('-init'))
    {
        fs.writeFileSync('.rxfs', `\
{
    "root": ".",
    "port": 1234,
    "baseurl": "/",
    "autoindex": false,
    "servedir": true,
    "headers": { "cache-control": "public, max-age=604800, immutable" },
    "mimes": {},
    "logfile": "rxfs.log",
    "verbose": true,
    "debug": false
}`
        )

        console.log(`created .rxfs template config file in the current directory`)
        return
    }

    //

    const os = require('os')
    const finalOpts = {}

    // file opts

    for (const overridePath of [
        `${ os.homedir() }/.config/rxfs`,
        `${ process.cwd() }/.rxfs`
    ])
    {
        if (fs.existsSync(overridePath))
        {
            console.log(`loading ${ overridePath }`)
            const _opts = JSON.parse(fs.readFileSync(overridePath, 'utf8'))
            for (const [k, v] of Object.entries(_opts)) finalOpts[k] = v
        }
    }

    // cli opts

    const { args, opts } = xdArgvParse(process.argv.slice(2))
    if (args.length > 2) throw new Error(`expected 0-2 arguments, got ${ args.length }\nif the directory path contains spaces, it must be enclosed in ""`)
    for (const [k, v] of Object.entries(opts)) finalOpts[k] = v
    if (args[1]) finalOpts.port = Number(args[1])
    if (args[0]) finalOpts.root = args[0]

    //

    new RXFS(finalOpts)
}