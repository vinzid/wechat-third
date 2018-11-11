'use strict'
const url = require('url');
const request = require('../func/request');
const config = require('../config/common.json');
const common = require('../func/common');
module.exports = (req, res, act) => {
    switch(act){
        case 'detail':
            let appid = url.parse(req.url, true).query.appid;
            if(req.session.appids && -1 !== req.session.appids.indexOf(appid) || -1 !== ['super', 'admin'].indexOf(req.session.role)){
                request.info({appid: appid, token: req.token, status: true}).then(result => {
                    let html = '<!doctype html><html><head><meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no"></head><body>';
                    html += '<p><a href="/user/appids/">&lt; 已授权</a></p>';
                    let info = result.authorizer_info;
                    if(info){
                        if(info.MiniProgramInfo){
                            let beta = 'http://apim.' + req.headers.host.replace(/^\w*?\./, '') + '/wx/app/beta/?appid=' + appid;
                            html += '<p><a href="' + beta + '"><img style="max-width:100%" src="' + beta + '" alt="beta qrcode" title="体验版二维码" /></a></p>';
                        }
                        html += '<p><label>名称：</label><span>' + info.nick_name + '</span></p>';
                        html += '<p><label>主体：</label><span>' + info.principal_name + '</span></p>'; 
                        html += '<p><label>原始名：</label><span>' + info.user_name + '</span></p>';
                    }
                    let jackets = common.require(config.dir.config + 'jackets.json');
                    let jacket = false;
                    if(jackets && -1 !== jackets.indexOf(appid)){
                        jacket = true;
                        html += '<p><label>马甲包/demo：</label><span>' + (jacket ? '是' : '否') + '</span></p>';
                    }
                    let status = result.status;
                    if(status){
                        html += '<p><label>状态：</label><span>' + status.label + '</span></p>';
                        let button = '提交审核';
                        if('-1' === status.value){
                            button = '首次' + button;
                        }
                        if(-1 !== ['super', 'admin'].indexOf(req.session.role)){
                            html += '<p><form action="/develop/submit/" method="post"><input name="appid" value="' + appid + '" type="hidden" /><input type="checkbox" name="autoPublish" value="true" checked /><label>自动发布</label> <button type="submit"' + ('2' === status.value ? ' disabled' : '') + ' onclick="return confirm(\'请确认体验版运行正常，确定要提交审核吗？\')">' + button + '</button></form></p>';
                        }
                        if('0' === status.value && (-1 !== ['super', 'admin'].indexOf(req.session.role))){
                            html += '<p><form action="/develop/publish/" method="post"><input name="appid" value="' + appid + '" type="hidden" /><button type="submit">发布</button></form></p>';
                        }
                    }
                    if(jacket){
                        html += '<p>关于马甲包/demo：</p>';
                        html += '<p>1. 确认体验版没问题后进行首次提交审核，通过后将自动发布。</p>';
                        html += '<p>2. 首次提交审核并通过后，将和主包同步提交审核和发布。</p>';
                    }
                    html += '<body></html>';
                    res.end(html);
                }).catch(results => {
                    console.log(results);
                    if(req.errorDebug){
                        res.end(JSON.stringify(results));
                    }else{
                        res.statusCode = 500;
                        res.end();
                    }
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