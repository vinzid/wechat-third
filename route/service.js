'use strict'
const url = require('url');
const fs = require('fs');
const config = require('../config/common.json');
const crypto = require('crypto');
const common = require('../func/common');
const request = require('../func/request');
const mongo = require('../func/mongo');
module.exports = (req, res, act) => {
    let authorization = req['headers'].authorization;
    if(!authorization){
        res.statusCode = 403;
        res.end();
        return;
    };
    let auhorArray = authorization.split("|");
    if(auhorArray.length < 2){
        res.statusCode = 403;
        res.end();
        return;
    };
    let timestamp = auhorArray[0];
    let signature = auhorArray[1];
    let currentTime = (new Date()).getTime();

    if(currentTime - timestamp > 60 * 1000){
        req.result.ecode = '0004';
        req.result.emsg = 'Time Out';
        res.end(JSON.stringify(req.result));
        return;
    };

    let md5 = crypto.createHash('md5');
    let orign = md5.update(config.service.key + timestamp + config.service.secret).digest('hex');
    if (orign !== signature){
        req.result.ecode = '0001';
        req.result.emsg = 'authorization error';
        res.end(JSON.stringify(req.result));
        return; 
    }
    switch(act){
        case 'unionid':
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
                    if(!data || !data.appid || !data.openid){
                        res.statusCode = 400;
                        res.end();
                        return;
                    }
                    mongo().then(db => {
                        let query = {};
                        query[data.appid] = data.openid;
                        db.collection('userId').findOne(query, (err, result) => {
                            if(err){
                                console.log(err);
                                req.result.ecode = '0001';
                                req.result.emsg = '请求失败，请稍候再试';
                                res.end(JSON.stringify(req.result));
                                return;
                            }
                            if(!result || !result.unionid){
                                req.result.data = null;
                                res.end(JSON.stringify(req.result));
                                return;
                            }
                            req.result.data = result.unionid;
                            res.end(JSON.stringify(req.result));
                            return;
                        });
                    }).catch(e => {
                        console.log(e);
                        req.result.ecode = '0001';
                        req.result.emsg = '请求失败，请稍候再试';
                        res.end(JSON.stringify(req.result));
                    })
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'redpack':
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
                    if(!data || !data.appid || !data.openid || !data.total_amount || !data.wishing || !data.act_name || !data.remark){
                        res.statusCode = 400;
                        res.end();
                        return;
                    }
                    let payInfo = common.require('./data/pay/' + data.appid + '.json');
                    if(!payInfo){
                        res.statusCode = 400;
                        res.end();
                        return;
                    }
                    let xmlData = {};
                    xmlData.wxappid = data.appid;
                    xmlData['re_openid'] = data.openid;
                    xmlData['total_amount'] = data.total_amount;
                    xmlData.wishing = data.wishing;
                    xmlData['act_name']= data.act_name;
                    xmlData.remark = data.remark;
                    let time = common.getTime();
                    xmlData['mch_billno'] = '';
                    for(let x in time){
                        xmlData['mch_billno'] += time[x];
                    }
                    xmlData['mch_billno'] += common.zeroPadding(Math.round(Math.random() * 999), 3);
                    xmlData['mch_id'] = payInfo.mch_id;
                    xmlData['send_name'] = payInfo.name;
                    xmlData['total_num'] = 1;
                    xmlData['client_ip'] = config.ip[process.env.NODE_ENV];
                    xmlData['nonce_str'] = crypto.randomBytes(16).toString('hex');
                    let dataKey = Object.keys(xmlData).sort();
                    let sign = '';
                    dataKey.forEach(v => {
                        sign += v + '=' + xmlData[v] + '&';
                    });
                    sign += 'key=' + payInfo.key;
                    xmlData['sign'] = crypto.createHash('md5').update(sign).digest('hex').toUpperCase();
                    request.request({
                        scheme: 'https',
                        hostname: 'api.mch.weixin.qq.com',
                        path: '/mmpaymkttransfers/sendredpack',
                        method: 'POST',
                        postData: common.json2xml(xmlData),
                        key: fs.readFileSync('./data/pay/' + data.appid + '_key.pem'),
                        cert: fs.readFileSync('./data/pay/' + data.appid + '_cert.pem'),
                        dataType: 'xml',
                        end: result => {
                            if('SUCCESS' !== result.result_code){
                                req.result.ecode = '0001';
                                req.result.emsg = '发放失败'
                            }else{
                                req.result.ecode = '0000';
                                req.result.emsg = '发放成功'
                            }
                            res.end(JSON.stringify(req.result));
                            mongo().then(db => {
                                xmlData.result = result;
                                db.collection('redpack').insertOne(xmlData, (err, result) => err && console.log(err));
                            }).catch(e => console.log(e));
                        },
                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
    }
}