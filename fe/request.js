'use strict'
const url = require('url');
const request = require('../func/request');
const config = require('../config/common.json');
const common = require('../func/common');
module.exports = (req, res, act) => {
    switch(act){
        case 'authorize':
            request.getCode(req.token, function(result){
                if(result.pre_auth_code){
                    res.writeHead(302, {
                        location: 'https://mp.weixin.qq.com/cgi-bin/componentloginpage?component_appid=' + config.appid + '&pre_auth_code=' + encodeURIComponent(result.pre_auth_code)  + '&redirect_uri=' + encodeURIComponent('http://' + req.headers.host + '/notify/authorize/'),
                    });
                    res.end('');
                }else{
                    console.log(result);
                    if(req.errorDebug){
                        res.end(JSON.stringify(result));
                    }else{
                        res.statusCode = 500;
                        res.end();
                    }
                }
            });
            break;
        default:
            res.statusCode = 403;
            res.end();
            break;
    }
};