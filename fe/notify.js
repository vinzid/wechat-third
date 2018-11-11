'use strict'
const url = require('url');
const fs = require('fs');
const crypto = require('crypto');
const request = require('../func/request');
const mongo = require('../func/mongo');
const common = require('../func/common');
const config = require('../config/common.json');
module.exports = (req, res, act) => {
    let query = url.parse(req.url, true).query;
    switch(act){
        case 'authorize':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let result = common.parseMessage(body);
                    if( config.appid === result.AppId){
                        result = common.decipher(result);
                        result = common.parseMessage(result);
                        if('component_verify_ticket' === result.InfoType && config.appid === result.AppId){
                            if(req.ticket !== result.ComponentVerifyTicket){
                                fs.writeFile(config.dir.cache + 'ticket.json', JSON.stringify(result), err => err && console.log(err));
                                request.getToken(result.ComponentVerifyTicket);
                                request.sync('cache', 'ticket', result);
                            }
                        }
                    }
                    res.end('Success');
                });
            }else{
                request.getAuth(req.token, query.auth_code, (appid) => {
                    if(!appid){
                        res.end('请求失败，请稍候再试');
                        return;
                    }
                    mongo().then(db => {
                        db.collection('user').updateOne({unionid: req.session.unionid}, {$addToSet: {appids: appid}}, err => {
                            if(err){
                                console.log(err);
                                if(req.errorDebug){
                                    res.end(err.stack);
                                }else{
                                    res.end('请求失败，请稍候再试');
                                }
                                return;
                            }
                            if(!req.session.appids){
                                req.session.appids = [];
                            }
                            if(-1 === req.session.appids.indexOf(appid)){
                                req.session.appids.push(appid);
                                fs.writeFileSync(config.dir.session + req.session.sessionId + '.json', JSON.stringify(req.session));
                            }
                            res.writeHead(302, {
                                location: '/app/detail/?appid=' + appid,
                            });
                            res.end('');
                        });
                    }).catch(err => {
                        if(req.errorDebug){
                            res.end(err.stack);
                        }else{
                            res.end('请求失败，请稍候再试');
                        }
                    })
                });
            }
            break;
        case 'message':
            let appid = query.appid;
            if(!appid){
                res.statusCode = 400;
                res.end();
                return;
            }
            appid = appid.replace(/^\//, '');
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    if(appid && '' !== body){
                        let result = common.parseMessage(body);
                        if(result.Encrypt){
                            result = common.decipher(result);
                            result = common.parseMessage(result);
                            if( 'event' === result.MsgType){
                                let filePath = config.dir.audit + appid + '.json';
                                if('weapp_audit_success' === result.Event){
                                    let submit = common.require(config.dir.submit + appid + '.json');
                                    if(submit && submit.autoPublish){
                                        request.publish({appid: appid}, (result) => {
                                            if(0 !== result.errcode){
                                                console.log(result);
                                            }
                                        });
                                    }
                                    fs.writeFile(filePath, JSON.stringify({data: appid, result: result}), err => err && console.log(err));
                                }else if('SCAN' === result.Event){
                                    fs.readFile(filePath, (err, records) => {
                                        if(err){
                                            records = [];
                                        }else{
                                            try{
                                                records = JSON.parse(records);
                                            }catch(e){
                                                records = [];
                                            }
                                        }
                                        records.unshift(result);
                                        fs.writeFile(filePath, JSON.stringify(records), err => err && console.log(err));
                                    });
                                }else if('user_get_card' === result.Event){
                                    if(result.UnionId){
                                        let set = {};
                                        set[appid] = result.FromUserName;
                                        mongo().then(db => {
                                            db.collection('userId').updateOne({unionid: result.UnionId}, {$set: set}, {upsert: true}, (err, result) => err && console.log(err));
                                        }).catch(e => console.log(e));
                                    }
                                    //通知测试环境更新openid
                                    if (process.env.NODE_ENV === config.notifyEnv){
                                        request.request({
                                            scheme: 'http',
                                            hostname: config.notifyTest,
                                            method: 'POST',
                                            postData: body,
                                            path: '/notify/message/?appid=/' + appid,
                                            end: function(notifyResult){
                                                if('Success' !== notifyResult){
                                                    console.log(notifyResult);
                                                }
                                            },
                                        });
                                    }
                                }
                            }
                            mongo().then(db => {
                                result.appid = appid;
                                db.collection('message').insertOne(result, (err, result) => err && console.log(err));
                            }).catch(e => console.log(e));
                        }
                        fs.writeFile(config.dir.message + appid + '.json', JSON.stringify({data: appid, result: body}), err => err && console.log(err));
                    }
                    res.end('Success');
                });
            }else{
                if(query.echostr){
                    let tmpArr = [query.nonce, query.timestamp, config.token];
                    tmpArr.sort();
                    let tmpStr = tmpArr.join('');
                    let hash = crypto.createHash('sha1');
                    hash.update(tmpStr);
                    let signature = hash.digest('hex');
                    if(signature === query.signature){
                        res.end(query.echostr);
                    }else{
                        res.end('error');
                    }
                    fs.writeFile(config.dir.message + appid + '.json', JSON.stringify({data: appid, query: query}), err => err && console.log(err));
                }else{
                    res.statusCode = 403;
                    res.end();
                }
            }
            break;
        case 'login':
            let state = query.state;
            if(state !== req.headers.host){
                if(!state || !state.match(/^localhost:\d+$/)){
                    res.statusCode = 400;
                    res.end();
                    return;
                }
                res.writeHead(302, {
                    location: 'http://' + state + req.url,
                });
                res.end('');
                return;
            }
            let code = query.code;
            if(!code){
                res.statusCode = 400;
                res.end();
                return;
            }
            request.login(code).then(user => {
                req.session.unionid = user.unionid;
                if(user.role){
                    req.session.role = user.role;
                }
                if(user.appids){
                    req.session.appids = user.appids;
                }
                fs.writeFileSync(config.dir.session + req.session.sessionId + '.json', JSON.stringify(req.session));
                res.writeHead(302, {
                    location: '/',
                });
                res.end('');
            }).catch(err => {
                if(req.errorDebug){
                    res.end(err.stack);
                }else{
                    res.end('请求失败，请稍候再试');
                }
            });
            break;
        default:
            res.statusCode = 403;
            res.end();
            break;
    }
};