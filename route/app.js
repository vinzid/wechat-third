'use strict'
const url = require('url');
const fs = require('fs');
const request = require('../func/request');
const config = require('../config/common.json');
const common = require('../func/common');
module.exports = (req, res, act) => {
    let appid = url.parse(req.url, true).query.appid;
    switch(act){
        case 'qrcode':
            try{
                fs.readFile(config.dir.qrcode + appid + '.jpg', (err, data) => {
                    if(err){
                        request.info({appid: appid, token: req.token}).then(result => {
                            if('object' === typeof result.authorizer_info){
                                let qrUrl = url.parse(result.authorizer_info.qrcode_url, true);
                                request.request({
                                    scheme: qrUrl.protocol.replace(/:$/, ''),
                                    hostname: qrUrl.host,
                                    path: qrUrl.path,
                                    end: result => {
                                        res.setHeader('Content-Type', 'image/jpeg');
                                        res.end(result);
                                        fs.writeFile(config.dir.qrcode + appid + '.jpg', result, err => err && console.log(err));
                                    }
                                });
                            }else{
                                console.log(result);
                                if(req.errorDebug){
                                    res.end(JSON.stringify(results));
                                }else{
                                    res.statusCode = 500;
                                    res.end();
                                }
                            }
                        });
                    }else{
                        res.setHeader('Content-Type', 'image/jpeg');
                        res.end(data);
                    }
                });
            }catch(e){
                console.log(e);
                res.statusCode = 500;
                res.end();
            }
            break;
        case 'beta':
            try{
                fs.readFile(config.dir.beta + appid + '.jpg', (err, data) => {
                    if(err){
                        request.getBeta(url.parse(req.url, true).query.appid).then(result => {
                            if(Buffer.isBuffer(result)){
                                res.setHeader('Content-Type', 'image/jpeg');
                                res.end(result);
                                fs.writeFile(config.dir.beta + appid + '.jpg', result, err => err && console.log(err));
                            }else{
                                res.end(JSON.stringify(result));
                            }
                        }).catch(result => {
                            res.end(result);
                        });
                    }else{
                        res.setHeader('Content-Type', 'image/jpeg');
                        res.end(data);
                    }
                });
            }catch(e){
                console.log(e);
                res.statusCode = 500;
                res.end();
            }
            break;
        default:
            res.statusCode = 403;
            res.end();
            break;
    }
};