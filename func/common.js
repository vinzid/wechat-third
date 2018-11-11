'use strict'
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/common.json');
const common = {
    parseMessage: (message) => {
        var result = {};
        message.replace(/<xml>|<\/xml>/, '').replace(/<!\[CDATA\[(.*?)\]\]>/ig, '$1').replace(/<(\w+)>(.*?)<\/\1>/g, function(_, key, value) {
            result[key] = value;
        });
        return result;
    },
    decipher: (result) => {
        let AESKey = new Buffer(config.key + '=', 'base64');
        let iv = AESKey.slice(0, 16);
        let decipher = crypto.createDecipheriv('aes-256-cbc', AESKey, iv);
        decipher.setAutoPadding(false);
        let deciphered = Buffer.concat([decipher.update(result.Encrypt, 'base64'), decipher.final()]);
        let pad = deciphered[deciphered.length - 1];
        if (pad < 1 || pad > 32) {
            pad = 0;
        }
        deciphered = deciphered.slice(0, deciphered.length - pad);
        let content = deciphered.slice(16);
        let length = content.slice(0, 4).readUInt32BE(0);
        return content.slice(4, length + 4).toString();
    },
    require: (file) => {
        let content;
        try{
            content = fs.readFileSync(file);
            content = JSON.parse(content);
        }catch(e){
        }
        return content;
    },
    session: (req, res) => {
        let sessionId
        if(req.headers.cookie){
            sessionId = req.headers.cookie.match(/sessionId=([\w-]*)/);
        }
        if(sessionId){
            req.session = common.require(config.dir.session + sessionId[1] + '.json');
        }
        if(!req.session){
            sessionId = crypto.createHash('sha256').update(Math.random().toString()).digest('hex');
            req.session = {
                sessionId: sessionId
            };
            fs.writeFileSync(config.dir.session + sessionId + '.json', JSON.stringify(req.session));
            res.setHeader('Set-Cookie', 'sessionId=' + sessionId + '; HttpOnly; Path=/');
        }
        if(!req.anonym && !req.session.unionid){
            res.writeHead(302, {
                location: 'https://open.weixin.qq.com/connect/qrconnect?appid=' + config.login.appid + '&redirect_uri=' + encodeURIComponent('http://' + config.login.domain + '/notify/login/') + '&response_type=code&scope=snsapi_login&state=' + req.headers.host + '#wechat_redirect',
            });
            res.end('');
            return false;
        }
        return true;
    },
    zeroPadding: (num, digit) => {
        if(!digit){
            digit = 2;
        }
        let result = num;
        for(let i = 1; i < digit; i++){
            if(num < Math.pow(10, i)){
                for(let j = digit; j > i; j--){
                    result = '0' + result;
                }
            }
        }
        return result;
    },
    getTime: () => {
        let time = new Date();
        return {
            year: time.getFullYear(),
            month: common.zeroPadding(time.getMonth() + 1),
            date: common.zeroPadding(time.getDate()),
            hour: common.zeroPadding(time.getHours()),
            minute: common.zeroPadding(time.getMinutes()),
            second: common.zeroPadding(time.getSeconds()),
            milliSecond: common.zeroPadding(time.getMilliseconds(), 3),
        }
    },
    json2xml: json => {
        let xml = '<xml>';
        for(let x in json){
            xml += '<' + x + '><![CDATA[' + json[x] + ']]></' + x + '>';
        }
        xml += '</xml>';
        return xml;
    },
};
module.exports = common;