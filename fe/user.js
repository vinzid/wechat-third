'use strict'
const url = require('url');
const fs = require('fs');
const querystring = require('querystring');
const request = require('../func/request');
const config = require('../config/common.json');
const common = require('../func/common');
const mongo = require('../func/mongo');
module.exports = (req, res, act) => {
    let html = '<!doctype html><html><head><meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no"></head><body>';
    let query = url.parse(req.url, true).query;
    let search;
    switch(act){
        case 'menu':
            mongo().then(db => {
                db.collection('permission').find({menu: true, role: {$in: [req.session.role, null]}}).sort({order: 1}).toArray(function(err, docs) {
                    if(err){
                        html += '<p>请求失败，请稍候再试</p>'
                        html += '</body></html>';
                        res.end(html);
                        return;
                    }
                    if(Array.isArray(docs) && docs.length > 0){
                        html += '<ul>';
                        docs.forEach(v => {
                            html += `<li><a href="/${v.type}/${v.act}/${v.query ? '?' + v.query : ''}">${v.title}</a></li>`;
                        });
                        html += '</ul>';
                    }else{
                        html += '<p>暂无菜单</p>'
                    }
                    html += '</body></html>';
                    res.end(html);
                });
            }).catch(e => {
                html += '<p>请求失败，请稍候再试</p>'
                html += '</body></html>';
                res.end(html);
            })
            break;
        case 'appids':
            html += '<p><a href="/">&lt; 首页</a></p>';
            let getAppids = new Promise((resolve, reject) => {
                if(-1 !== ['super', 'admin'].indexOf(req.session.role)){
                    let appids = [];
                    request.getAuhorizer(req.token).then(result => {
                        if(result.list){
                            result.list.forEach(function(v){
                                appids.push(v.authorizer_appid);
                            });
                            resolve(appids);
                        }else{
                            reject(result);
                        }
                    });
                }else{
                    resolve(req.session.appids);
                }
            });
            getAppids.then(result => {
                if(result){
                    html += '<table border="1" cellspacing="0" cellpadding="10">';
                    html += '<tr><th>appid</th><th>名称</th><th>主体</th><th>类型</th>';
                    if(-1 !== ['super', 'admin'].indexOf(req.session.role)){
                        html += '<th>马甲包</th>'
                    }
                    html += '<th>状态</th><th>操作</th></tr>';
                    let infos = [];
                    result.forEach(v => {
                        infos.push(request.info({appid: v, token: req.token, status: true}));
                    });
                    Promise.all(infos).then(results => {
                        results.forEach((w, i) => {
                            let info = w.authorizer_info;
                            html += '<tr>';
                            html += '<td>' + result[i] + '</td>';
                            if(info){
                                html += '<td>' + info.nick_name + '</td>';
                                html += '<td>' + info.principal_name + '</td>';
                                html += '<td>' + (info.MiniProgramInfo ? '小程序' : '公众号') + '</td>';
                            }else{
                                html += '<td></td><td></td><td></td>';
                            }
                            let jackets = common.require(config.dir.config + 'jackets.json');
                            if(-1 !== ['super', 'admin'].indexOf(req.session.role)){
                                html += '<td>' + (jackets && -1 !== jackets.indexOf(result[i]) ? '是' : '否') + '</td>';
                            }
                            let status = w.status;
                            if(status){
                                html += '<td>' + status.label + '</td>';
                            }else{
                                html += '<td> - </td>';
                            }
                            html += '<td><a href="/app/detail/?appid=' + result[i] + '">查看</a></td>';
                            html += '</tr>';
                        });
                        html += '</table>';
                        html += '</body></html>';
                        res.end(html);
                    }).catch(results => {
                        console.log(results);
                        html += '<tr><td colspan="4">';
                        if(req.errorDebug){
                            html += JSON.stringify(results);
                        }else{
                            html += '请求失败，请稍候再试'
                        }
                        html += '</td></tr>';
                        html += '</table>';
                        html += '</body></html>';
                        res.end(html);
                    });
                }else{
                    html += '<p>暂无授权</p>';
                    html += '</body></html>';
                    res.end(html);
                }
            }).catch(result => {
                console.log(result);
                html += '<p>请求失败，请稍候再试</p>'
                html += '</body></html>';
                res.end(html);
            });
            break;
        case 'logout':
            fs.writeFile(config.dir.session + req.session.sessionId + '.json', JSON.stringify({sessionId: req.session.sessionId}), err => {
                if(err){
                    html += '<p>退出失败</p>';
                }else{
                    html += '<p>退出成功</p>';
                }
                res.end(html);
            });
            break;
        case 'setting':
            search = {unionid: req.session.unionid};
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let data = querystring.parse(body);
                    let script = '<script>setTimeout(function(){location.href = "' + req.url + '";}, 3000)</script>'
                    if(data.name){
                        mongo().then(db => {
                            db.collection('user').updateOne(search, {$set: {name: data.name}}, (err, result) => {
                                if(err || 0 === result.result.n){
                                    html += '<p>更新失败</p>' + script;
                                }else{
                                    html += '<p>更新成功</p>' + script;
                                }
                                html += '</body></html>';
                                res.end(html);
                            });
                        });
                    }else{
                        html += '<p>设置缺失</p>' + script;
                        html += '</body></html>';
                        res.end(html);
                    }
                });
            }else{
                mongo().then(db => {
                    db.collection('user').findOne(search, (err, doc) => {
                        if(err){
                            html += '<p>请求失败，请稍候再试</p>';
                        }else{
                            html += '<form method="POST">';
                            html += '<p><label>姓名：</label><input name="name" value="' + (doc && doc.name ? doc.name : '') + '" /></p>';
                            html += '<p style="margin-left:3em;"><button type="submit">确认</button></p>';
                        }
                        html += '</body></html>';
                        res.end(html);
                    });
                });
            }
            break;
        default:
            res.statusCode = 403;
            res.end();
            break;
    }
};