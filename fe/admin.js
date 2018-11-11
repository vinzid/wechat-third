const url = require('url');
const ObjectId = require('mongodb').ObjectId;
const mongo = require('../func/mongo');
const request = require('../func/request');
module.exports = async function(req, res, act){
    let html = '';
    let query = url.parse(req.url, true).query;
    let search;
    if(!query.collection){
        throw new Error(400);
    }
    db = await mongo();
    let collection = db.collection(query.collection);
    let admin = await db.collection('admin').findOne({collection: query.collection});
    if(!admin){
        throw new Error(403);
    }
    switch(act){
        case 'list':
            html += '<p><a href="/">&lt; 首页</a></p>';
            if(!admin.list){
                throw new Error(403);
            }
            let cursor = collection.find();
            html += '<table border="1" cellspacing="0" cellpadding="10"><tr>';
            admin.list.forEach(v => {
                html += `<th>${v.title}</th>`;
            });
            html += '<th>操作</th></tr>'
            while(await cursor.hasNext()){
                let user = await cursor.next();
                html += '<tr>'
                admin.list.forEach(v => {
                    html += `<td>${user[v.key] || ''}</td>`;
                });
                html += '<td><a href="/admin/detail/?collection=user&_id=' + user._id + '">查看</a></td>';
            }
            break;
        case 'detail':
            html += `<p><a href="/admin/list/?collection=${query.collection}">&lt; 用户</a></p>`;
            if(!query._id){
                throw new Error(400);
            }
            search = {_id: ObjectId(query._id)};
            if(!admin.detail){
                throw new Error(403);
            }
            let doc = await collection.findOne(search);
            let editable = true;
            if('user' === query.collection){
                let role = admin.detail.find(v => 'role' === v.key);
                if(-1 !== ['super'].indexOf(req.session.role)){
                    role.option.unshift('admin');
                    if('super' === doc.role){
                        delete role.editable
                    }
                }else if(-1 !== ['super', 'admin'].indexOf(doc.role)){
                    admin.detail.map(v => delete v.editable);
                    editable = false;
                }
            }
            if('POST' === req.method){
                let data = await request.data(req);
                let script = '<script>setTimeout(function(){location.href = "' + req.url + '";}, 3000)</script>';
                for(let x in data){
                    let item = admin.detail.find(v => x === v.key);
                    if(!item.editable || 'select' === item.type && data[x] && -1 === item.option.indexOf(data[x])){
                        delete data[x];
                    }
                }
                let result;
                if(Object.keys(data).length > 0){
                    result = await collection.updateOne(search, {$set: data});
                }
                if(!result || 0 === result.result.n){
                    html += '<p>更新失败</p>' + script;
                }else{
                    html += '<p>更新成功</p>' + script;
                }
            }else{
                if(!doc){
                    html += '<p>无此记录</p>';
                }else{
                    html += '<form method="POST">'
                    admin.detail.forEach(v => {
                        html += `<p><admin.detail>${v.title}：</admin.detail><span>`;
                        if(v.editable){
                            switch(v.type){
                                case 'select':
                                    html += `<select name="${v.key}"><option value="">请选择</option>`;
                                    if(v.option){
                                        v.option.forEach(w => {
                                            html += `<option${doc.role === w ? ' selected' : ''} value="${w}">${w}</option>`;
                                        })
                                    }
                                    html += '</select>';
                                    break;
                                default:
                                    html += `<input type="text" name="${v.key}" value="${doc[v.key] || ''}" />`;
                            }
                        }else{
                            switch(v.type){
                                case 'img':
                                    html += `<img src="${doc[v.key] || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}" width="20" />`;
                                    break;
                                default: 
                                    html += doc[v.key] || '';
                            }
                        }
                    });
                    if(editable){
                        html += '<p style="margin-left:3em;"><button type="submit">更新</button></p>';
                    }
                    html += '</form>'
                }
            }
            break;
        default:
            html += '<p>请求失败，请稍候再试</p>';
            break;
    }
    return html;
};