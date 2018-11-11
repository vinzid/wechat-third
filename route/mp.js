'use strict'
const crypto = require('crypto');
const url = require('url');
const config = require('../config/common.json');
const common = require('../func/common');
const request = require('../func/request');
const mongo = require('../func/mongo');
const fs = require('fs');
module.exports = (req, res, act) => {
    switch(act){
        case 'loginUrl':
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
                    res.end(JSON.stringify({
                        ecode: '0000',
                        data: 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + data.appid + '&redirect_uri=' + encodeURIComponent(data.redirect_uri) + '&response_type=code&scope=snsapi_userinfo&state=STATE&component_appid=' + config.appid + '#wechat_redirect'
                    }));
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'login':
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
                    request.request({
                        path: '/sns/oauth2/component/access_token?appid=' + data.appid + '&code=' + data.code + '&grant_type=authorization_code&component_appid=' + config.appid + '&component_access_token=' + req.token,
                        end: (result) => {
                            if(result.access_token && result.openid){
                                request.request({
                                    path: '/sns/userinfo?access_token=' + result.access_token + '&openid=' + result.openid,
                                    end: (result) => {
                                        if(result.openid){
                                            req.result.data.openid = result.openid;
                                            let rawData = result;
                                            delete rawData.openid;
                                            delete rawData.privilege;
                                            let exchange = {
                                                'sex': 'gender',
                                                'headimgurl': 'avatarUrl'
                                            };
                                            for(let x in exchange){
                                                rawData[exchange[x]] = rawData[x];
                                                delete rawData[x];
                                            }
                                            req.result.data.rawData = JSON.stringify(rawData);
                                            let AESKey = new Buffer(config.key.substr(0, 16));
                                            req.result.data['session_key'] = AESKey.toString('base64');
                                            let iv = new Buffer(config.key.substr(16, 16));
                                            req.result.data.iv = iv.toString('base64');
                                            let hash = crypto.createHash('sha1');
                                            hash.update(req.result.data.rawData + req.result.data['session_key']);
                                            req.result.data.signature = hash.digest('hex');
                                            let cipher = crypto.createCipheriv('aes-128-cbc', AESKey, iv);
                                            cipher.setAutoPadding(true);
                                            rawData.openId = req.result.data.openid;
                                            if(req.result.data.unionid){
                                                rawData.unionId = req.result.data.unionid;
                                            }
                                            rawData.watermark = {
                                                timestamp: Math.round((new Date()).getTime() / 1000),
                                                appid: data.appid,
                                            }
                                            let ciphered = Buffer.concat([cipher.update(JSON.stringify(rawData), 'utf8'), cipher.final()]);
                                            req.result.data.encryptedData = ciphered.toString('base64');
                                            res.end(JSON.stringify(req.result));
                                        }else{
                                            req.result.ecode = result.errcode;
                                            req.result.emsg = result.errmsg;
                                            res.end(JSON.stringify(req.result));
                                        }
                                    },
                                });
                            }else{
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
        case 'jssdk':
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
                        return;
                    }
                    let appInfo;
                    try{
                        appInfo = common.require(config.dir.cache + appid + '.json');
                    }catch(e){
                    }
                    if(!appInfo || 'object' !== typeof appInfo.jssdk_info){
                        req.result.ecode = '0001';
                        req.result.emsg = 'Appid Error';
                        res.end(JSON.stringify(req.result));
                        return;
                    }
                    let nonceStr = crypto.randomBytes(8).toString('hex');
                    let timestamp = Math.round((new Date()).getTime() / 1000);
                    let hash = crypto.createHash('sha1');
                    hash.update('jsapi_ticket=' + appInfo.jssdk_info.ticket + '&noncestr=' + nonceStr + '&timestamp=' + timestamp + '&url=' + data.url);
                    let signature = hash.digest('hex');
                    req.result.data = {
                        debug: req.errorDebug ? true : false,
                        appId: data.appid,
                        timestamp: timestamp,
                        nonceStr: nonceStr,
                        signature: signature,
                        jsApiList: ['onMenuShareAppMessage', 'onMenuShareTimeline', 'onMenuShareQQ', 'onMenuShareWeibo', 'onMenuShareQZone']
                    }
                    res.end(JSON.stringify(req.result));
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'qrcode':
            let query = url.parse(req.url, true).query
            let appid = query.appid;
            if(!appid){
                res.statusCode = 400;
                res.end();
                return;
            }
            let appInfo;
            try{
                appInfo = common.require(config.dir.cache + appid + '.json');
            }catch(e){
                req.result.ecode = '0001';
                req.result.emsg = 'Appid Error';
                res.end(JSON.stringify(req.result));
                return;
            }
            request.request({
                path: '/cgi-bin/qrcode/create?access_token=' + appInfo.authorization_info.authorizer_access_token,
                method: 'POST',
                postData: {
                    'action_name': 'QR_LIMIT_STR_SCENE',
                    'action_info': {
                        'scene': {
                            'scene_str': query.scene || 'qrcode'
                        }
                    }
                },
                end: result => {
                    if(result.ticket){
                        request.request({
                            hostname: 'mp.weixin.qq.com',
                            path: '/cgi-bin/showqrcode?ticket=' + encodeURIComponent(result.ticket),
                            end: result => {
                                res.setHeader('Content-Type', 'image/jpeg');
                                res.end(result);
                            }
                        });
                    }else{
                        console.log(result);
                        if(req.errorDebug){
                            res.end(JSON.stringify(result));
                        }else{
                            res.statusCode = 500;
                            res.end();
                        }
                    }
                }
            });
            break;
        case 'subscribed':
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
                        return;
                    }
                    let appInfo;
                    try{
                        appInfo = common.require(config.dir.cache + appid + '.json');
                    }catch(e){
                    }
                    if(!appInfo || 'object' !== typeof appInfo.jssdk_info){
                        req.result.ecode = '0001';
                        req.result.emsg = 'Appid Error';
                        res.end(JSON.stringify(req.result));
                        return;
                    }
                    request.request({
                        path: '/cgi-bin/user/info?access_token=' + appInfo.authorization_info.authorizer_access_token + '&openid=' + data.openid + '&lang=zh_CN',
                        end: result => {
                            req.result.data = 1 === result.subscribe ? true : false;
                            res.end(JSON.stringify(req.result));
                        },
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