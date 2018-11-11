'use strict'
const url = require('url');
const request = require('../func/request');
const mongo = require('../func/mongo');
const config = require('../config/common.json');
const common = require('../func/common');
const fs = require('fs');
module.exports = (req, res, act) => {
    switch(act){
        case 'login':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    try{
                        body = JSON.parse(body);
                    }catch(e){
                        console.log(e);
                    }
                    let appid = body.appid;
                    if(!appid){
                        res.statusCode = 400;
                        res.end();
                        return;
                    }
                    let appInfo;
                    try{
                        appInfo = common.require(config.dir.cache + appid + '.json');
                    }catch(e){
                        res.end(JSON.stringify({
                            ecode: '0001',
                            emsg: 'Appid Error'
                        }));
                        return;
                    }
                    let mini = require('../config/mini.json');
                    let miniInfo = mini.find(v => appid === v.appid);
                    let path;
                    if(miniInfo){
                        path = '/sns/jscode2session?appid=' + appid + '&secret=' + miniInfo.secret + '&js_code=' + body.code + '&grant_type=authorization_code';
                    }else{
                        path = '/sns/component/jscode2session?appid=' + appid + '&js_code=' + body.code + '&grant_type=authorization_code&component_appid=' + config.appid + '&component_access_token=' + req.token;
                    }
                    request.request({
                        method: 'GET',
                        path: path,
                        end: function(result){
                            if(result.openid){
                                if(miniInfo){
                                    delete result['session_key'];
                                    if(result.unionid){
                                        let set = {};
                                        set[appid] = result.openid;
                                        mongo().then(db => {
                                            db.collection('userId').updateOne({unionid: result.unionid}, {$set: set}, {upsert: true}, (err, result) => err && console.log(err));
                                        }).catch(e => console.log(e));
                                    }
                                }
                                res.end(JSON.stringify({
                                    ecode: '0000',
                                    data: result
                                }));
                            }else{
                                console.log(path, result);
                                res.end(JSON.stringify({
                                    ecode: result.errcode,
                                    emsg: result.errmsg
                                }));
                            }
                        },
                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'qrcode':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    try{
                        body = JSON.parse(body);
                    }catch(e){
                        console.log(e);
                    }
                    let appid = body.appid;
                    if(!appid){
                        res.statusCode = 400;
                        res.end();
                        return;
                    }
                    let appInfo;
                    req.result = {
                        ecode: '0000',
                    };
                    try{
                        appInfo = common.require(config.dir.cache + appid + '.json');
                    }catch(e){
                        req.result.ecode = '0001';
                        req.result.emsg = 'Appid Error';
                        res.end(JSON.stringify(req.result));
                        return;
                    }
                    let path = '/cgi-bin/wxaapp/createwxaqrcode?access_token=' + appInfo.authorization_info.authorizer_access_token;
                    request.request({
                        method: 'POST',
                        path: path,
                        proxy: true,
                        postData: {
                            path: body.path
                        },
                        end: function(result){
                            if(Buffer.isBuffer(result)){
                                req.result.data = result.toString('base64');
                                res.end(JSON.stringify(req.result));
                            }else{
                                res.end(JSON.stringify(result));
                            }
                        },
                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'code':
            let query = url.parse(req.url, true).query
            let appid = query.appid;
            if(!appid){
                res.statusCode = 400;
                res.end();
                return;
            }
            let appInfo;
            req.result = {
                ecode: '0000',
            };
            try{
                appInfo = common.require(config.dir.cache + appid + '.json');
            }catch(e){
                req.result.ecode = '0001';
                req.result.emsg = 'Appid Error';
                res.end(JSON.stringify(req.result));
                return;
            }
            let path = '/wxa/getwxacodeunlimit?access_token=' + appInfo.authorization_info.authorizer_access_token;
            let scene = req.url.replace(/(^[^?]+\?|(appid|page|format|width|line_color)=?[^&=#]*&?)/g, '');
            if(!scene){
                scene = 'null';
            }
            if(scene.length > 32){
                let ext;
                try{
                    ext = require('../config/' + appid + '.json');
                }catch(e){
                }
                if(ext && ext.ext && ext.ext.scene && ext.ext.scene[query.page]){
                    let scenes = [];
                    ext.ext.scene[query.page].forEach(v => {
                        let match = scene.match(new RegExp(v + '=([^&=#]+)'));
                        scenes.push(match ? match[1] : '');
                    });
                    scene = scenes.join();
                }else{
                    req.result.ecode = '0001';
                    req.result.emsg = 'Parameters Error';
                    res.end(JSON.stringify(req.result));
                    return;
                }
            }
            if(query.line_color){
                try{
                    query.line_color = JSON.parse(query.line_color);
                }catch(e){
                    delete query.line_color;
                }
            }
            request.request({
                method: 'POST',
                path: path,
                proxy: true,
                postData: {
                    page: query.page,
                    scene: scene,
                    width: query.width,
                    auto_color: query.auto_color,
                    line_color: query.line_color,
                },
                end: function(result){
                    res.setHeader('Cache-Control', 'max-age=2592000');
                    if(Buffer.isBuffer(result)){
                        if('jpg' === query.format){
                            res.setHeader('Content-Type', 'image/jpeg');
                            res.end(result);
                        }else{
                            req.result.data = result.toString('base64');
                            if('base64' === query.format){
                                res.end(req.result.data);
                            }else{
                                res.end(JSON.stringify(req.result));
                            }
                        }
                    }else{
                        res.end(JSON.stringify(result));
                    }
                },
            });
            break;
        case 'notify':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let data;
                    try{
                        data = JSON.parse(body);
                    }catch(e){
                        console.log(e);
                    }
                    let appid = data.appid;
                    if(!appid){
                        res.statusCode = 400;
                        res.end();
                    }
                    let appInfo;
                    req.result = {
                        ecode: '0000',
                    };
                    try{
                        appInfo = common.require(config.dir.cache + appid + '.json');
                    }catch(e){
                        req.result.ecode = '0001';
                        req.result.emsg = 'Appid Error';
                        res.end(JSON.stringify(req.result));
                        return;
                    }
                    const notify = require('../config/notify.json');
                    let notifyInfo = notify[data.type]
                    if(!notifyInfo){
                        req.result.ecode = '0001';
                        req.result.emsg = 'Notify Type Error';
                        res.end(JSON.stringify(req.result));
                        return;
                    }
                    data.page = notifyInfo.page;
                    request.notifyTemplate(appid).then(result => {
                        if(0 === result.errcode){
                            if(result.list){
                                let template = result.list.find(v => {
                                    return notifyInfo.title === v.title;
                                });
                                if(template){
                                    data.template_id = template.template_id;
                                    request.notify(data).then(result => {
                                        req.result.ecode = 0 === result.errcode ? "0000" : result.errcode;
                                        req.result.emsg = result.errmsg;
                                        res.end(JSON.stringify(req.result));
                                    });
                                }else{
                                    req.result.ecode = '0001';
                                    req.result.emsg = 'Notify Template Error';
                                    res.end(JSON.stringify(req.result));
                                }
                            }
                        }else{
                            req.result.ecode = result.errcode;
                            req.result.emsg = result.errmsg;
                            res.end(JSON.stringify(req.result));
                        }
                        let template = result
                    }).catch(result => {
                        req.result.ecode = '0001';
                        req.result.emsg = result;
                        res.end(JSON.stringify(req.result));
                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        default:
            res.statusCode = 403;
            res.end();
            break;
    }
};