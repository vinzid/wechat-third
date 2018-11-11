'use strict'
const http = require('http');
const fs = require('fs');
const url = require('url');
const config = require('./config/common.json');
const request = require('./func/request');
const common = require('./func/common');
const cache = require('./func/cache');
const mongo = require('./func/mongo');
process.setMaxListeners(0);
fs.stat('./data', (err, stats) => {
    if(err){
        fs.mkdirSync('./data');
    }
    for(let x in config.dir){
        fs.stat(config.dir[x], (err, stats) => {
            if(err){
                fs.mkdir(config.dir[x], () => {});
            }else if('session' === x){
                fs.readdir(config.dir[x], (err, files) => {
                    if(!err){
                        files.forEach(v => {
                            let file = config.dir[x] + v;
                            fs.stat(file, (err, stats) => {
                                if((Date.now() - (new Date(stats.birthtime)).getTime())/(1000 * 3600 * 24) > 1){
                                    fs.unlink(file, () => {});
                                }
                            });
                        });
                    }
                });
            }
        });
    }
});
if(-1 === ['testing', 'production'].indexOf(process.env.NODE_ENV)){
    process.env.NODE_ENV = 'development';
    if(config.cache){
        try{
            require('child_process').exec(`scp -r ${config.cache} ./data`);
        }catch(e){
        }
    }
}
let ticket, token, errorDebug;
ticket = cache.ticket();
token = cache.token();
errorDebug = -1 === ['testing', 'production'].indexOf(process.env.NODE_ENV);
http.createServer((req, res) => {
    process.on('uncaughtException', function(err){
        console.log('uncaughtException', err.stack);
        if(res.finished){
            return;
        }
        if(req.errorDebug){
            res.end('<pre>' + err.stack + '</pre>');
        }else{
            res.statusCode = 500;
            res.end();
        }
    });
    req.ticket = cache.ticket();
    req.token = cache.token();
    req.errorDebug = errorDebug || '1' === url.parse(req.url, true).query.errorDebug;
    req.admin = -1 !== ['127.0.0.1', '114.215.174.200', '116.62.243.155'].indexOf(req.headers['x-real-ip']);
    let match = req.url.match(/^\/wx\/(\w+)\/(\w+)\//);
    if(match){
        req.result = {
            ecode: '0000',
            data: {}
        };
        try{
            require('./route/' + match[1])(req, res, match[2]);
        }catch(e){
            console.log(e);
            res.statusCode = 500;
            res.end();
        }
    }else{
        let match = req.url.match(/^\/(\w+)\/(\w+)\//);
        if('/' === req.url){
            match = [
                '',
                'user',
                'menu'
            ]
        }
        if(match){
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            mongo().then(db => {
                db.collection('permission').findOne({type: match[1], act: {$in: ['*', match[2]]}}, {sort: {act: -1}}, (err, doc) => {
                    if(err){
                        console.log(err);
                        res.statusCode = 500;
                        res.end();
                        return;
                    }
                    if(doc && doc.anonym){
                        req.anonym = doc.anonym;
                    }
                    if(!common.session(req, res)){
                        return;
                    }
                    if(!doc || !Array.isArray(doc.role) || 0 === doc.role.length || -1 !== doc.role.indexOf(req.session.role)){
                        try{
                            let route = require('./fe/' + match[1])(req, res, match[2]);
                            if(route instanceof Promise){
                                let html = '<!doctype html><html><head><meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no"></head><body>';
                                route.then(result => {
                                    html += result + '</body></html>';
                                    res.end(html);
                                }).catch(err => {
                                    console.log(err);
                                    res.statusCode = parseInt(err.message) || 500;
                                    res.end();
                                });
                            }
                        }catch(e){
                            console.log(e);
                            res.statusCode = 500;
                            res.end();
                        }
                    }else{
                        res.statusCode = 403;
                        res.end();
                        return;
                    }
                });
            }).catch(e => {
                res.statusCode = 500;
                res.end();
            });
        }else{
            res.statusCode = 403;
            res.end();
        }
    }
}).listen(9031);
mongo().then().catch(e => {});