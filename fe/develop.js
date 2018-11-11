'use strict'
const url = require('url');
const fs = require('fs');
const querystring = require('querystring');
const ObjectID = require('mongodb').ObjectID;
const request = require('../func/request');
const config = require('../config/common.json');
const common = require('../func/common');
const mongo = require('../func/mongo');
module.exports = (req, res, act) => {
    let query = url.parse(req.url, true).query;
    let html = '<!doctype html><html><head><meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no"></head><body>'
    html += '<p><a href="/">&lt; 首页</a></p>';
    let restrictView;
    let restrictUpdate;
    let updatable;
    let viewable;
    switch(act){
        case 'commit':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let data = querystring.parse(body);
                    const script = '<script>setTimeout(function(){location.href = "/";}, 3000)</script>';
                    let method = 'commitAll';
                    if(data.appid){
                        if(config.mainAppid === data.appid){
                            method = 'commitMulti';
                        }else{
                            method = 'commit';
                        }
                    }
                    request[method](data, req.token).then(result =>{
                        html += '<p>提交体验版成功</p>' + script;
                        fs.writeFile(config.dir.cache + 'commit.json', JSON.stringify({data: body, result: result}), err => err && console.log(err));
                        html += '<body></html>';
                        res.end(html);
                    }).catch(result => {
                        console.log(result);
                        if(req.errorDebug){
                            html += JSON.stringify(result);
                        }else{
                            html += '<p>提交体验版失败</p>' + script;
                        }
                        html += '<body></html>';
                        res.end(html);
                    });
                });
            }else{
                let data = {};
                let commit = common.require(config.dir.cache + 'commit.json');
                if('object' === typeof commit){
                    if('string' === typeof commit.data){
                        commit.data = querystring.parse(commit.data);
                    }
                    if('object' === typeof commit.data){
                        data = commit.data;
                    }
                }
                html += '<form method="post"><p><label>appid：</label><input name="appid" value="' + (data.appid || '') + '" /></p><p><label>模板编号：</label><input name="template_id" value="' + (data.template_id || '') + '" required /></p><p><label>版本号：</label><input name="user_version" value="' + (data.user_version || '') + '" required /></p><p><label>描述：</label><input name="user_desc" value="' + (data.user_desc || '') + '" required /></p><p><button type="submit">确认</button></p></form>';
                res.end(html);
            }
            break;
        case 'bat':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let data = querystring.parse(body);
                    let query = url.parse(req.url, true).query;
                    if('submit' === query.type){
                        request.getAuhorizer(req.token).then(result => {
                            if(result.list){
                                let appids = [];
                                result.list.forEach(function(v){
                                    appids.push(v.authorizer_appid);
                                });
                                let published = request.published(appids);
                                const script = '<script>setTimeout(function(){location.href = "/develop/bat/";}, 3000)</script>';
                                request.submitMulti({appids: published, autoPublish: data.autoPublish}).then(result => {
                                    html += '<p>提交审核成功</p>' + script;
                                    html += '<body></html>';
                                    res.end(html);
                                }).catch(result => {
                                    console.log(result);
                                    html += '<p>提交审核失败</p>'
                                    if(req.errorDebug){
                                        html += '<pre>' + JSON.stringify(result) + '</pre>';
                                    }else{
                                        html += script;
                                    }
                                    html += '<body></html>';
                                    res.end(html);
                                });
                            }else{
                                html += '<p>暂无已发布小程序</p>'
                                res.end(html);
                            }
                        });
                    }else{
                       request.request({
                            method: 'POST',
                            path: '/wxa/addtotemplate?access_token=' + req.token,
                            postData: data,
                            end: result => {
                                if(0 === result.errcode){
                                    request.template(req.token).then(result => {
                                        data = result[result.length - 1];
                                        body = JSON.stringify(data);
                                        const script = '<script>setTimeout(function(){location.href = "/develop/bat/";}, 3000)</script>';
                                        request.commitAll(data, req.token).then(result =>{
                                            html += '<p>提交体验版成功</p>' + script;
                                            fs.writeFile(config.dir.cache + 'commit.json', JSON.stringify({data: JSON.parse(body), result: result}), err => err && console.log(err));
                                            html += '<body></html>';
                                            res.end(html);
                                        }).catch(result => {
                                            console.log(result);
                                            html += '<p>提交体验版失败</p>'
                                            if(req.errorDebug){
                                                html += '<pre>' + JSON.stringify(result) + '</pre>';
                                            }else{
                                                html += script;
                                            }
                                            res.end(html);
                                        });
                                        request.request({
                                            method: 'POST',
                                            path: '/wxa/deletetemplate?access_token=' + req.token,
                                            postData: {
                                                template_id: result[0].template_id
                                            }
                                        });
                                    });
                                }else{
                                    console.log(result);
                                    html += '<p>提交体验版失败</p>'
                                    if(req.errorDebug){
                                        html += '<pre>' + JSON.stringify(result) + '</pre>';
                                    }else{
                                        html += script;
                                    }
                                    res.end(html);
                                }
                            }
                        });
                    }
                });
            }else{
                request.request({
                    path: '/wxa/gettemplatedraftlist?access_token=' + req.token,
                    end: result => {
                        if(0 === result.errcode){
                            if(Array.isArray(result.draft_list) && result.draft_list.length > 0){
                                html += '<table border="1" cellspacing="0" cellpadding="10"><tr><th>编号</th><th>版本号</th><th>描述</th><th>操作</th></tr>';
                                result.draft_list.forEach(v => {
                                    html += '<tr><td>' + v.draft_id + '</td><td>' + v.user_version + '</td><td>' + v.user_desc + '</td><td><form method="post" action="?type=beta"><input type="hidden" name="draft_id" value="' + v.draft_id + '"><button type="submit">提交体验版</button></form></td></tr>'
                                });
                                html += '</table>'
                                html += '<p><form method="post" action="?type=submit"><input type="checkbox" name="autoPublish" value="true" checked /><label>自动发布</label> <button type="submit" onclick="return confirm(\'所有已发布过的小程序将同时提交审核，确认要提交吗？\')">提交审核</button></form></p>'
                            }else{
                                html += '<p>暂无草稿</p>'
                            }
                        }else{
                            html += '<p>请求失败，请稍候再试</p>'
                            if(req.errorDebug){
                                html += '<pre>' + JSON.stringify(result, null, '    ') + '</pre>'
                            }
                        }
                        res.end(html);
                    },
                });
            }
            break;
        case 'submit':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let data = querystring.parse(body);
                    if( -1 !== ['super', 'admin'].indexOf(req.session.role) || req.session.appids && -1 !== req.session.appids.indexOf(data.appid)){
                        const script = '<script>setTimeout(function(){location.href = "/app/detail/?appid=' + data.appid + '";}, 3000)</script>';
                        request.submitMulti(data).then(result => {
                            html += '<p>提交审核成功</p>' + script;
                            html += '<body></html>';
                            res.end(html);
                        }).catch(result => {
                            console.log(result);
                            if(req.errorDebug){
                                html += JSON.stringify(result);
                            }else{
                                html += '<p>提交审核失败</p>' + script;
                            }
                            html += '<body></html>';
                            res.end(html);
                        });
                    }else{
                        res.statusCode = 403;
                        res.end();
                    }
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'publish':
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let data = querystring.parse(body);
                    if(-1 !== ['super', 'admin'].indexOf(req.session.role) || req.session.appids && -1 !== req.session.appids.indexOf(data.appid)){
                        const script = '<script>setTimeout(function(){location.href = "/app/detail/?appid=' + data.appid + '";}, 3000)</script>';
                        request.publish(data, result => {
                            if(0 === result.errcode){
                                html += '<p>发布成功</p>' + script;
                                html += '<body></html>';
                                res.end(html);
                            }else{
                                console.log(result);
                                if(req.errorDebug){
                                    html += JSON.stringify(result);
                                }else{
                                    html += '<p>发布失败</p>' + script;
                                }
                                html += '<body></html>';
                                res.end(html);
                            }
                        });
                    }else{
                        res.statusCode = 403;
                        res.end();
                    }
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'data':
            let dir = url.parse(req.url, true).query.dir;
            restrictUpdate = Object.keys(config.dir).filter(v => -1 === ['notify'].indexOf(v));
            restrictUpdate.push('pay');
            restrictView = restrictUpdate.filter(v => -1 === ['log'].indexOf(v));
            viewable = 'production' === process.env.NODE_ENV ? -1 !== ['super', 'admin'].indexOf(req.session.role) : true;
            updatable = -1 !== ('production' === process.env.NODE_ENV ? ['super'] : ['super', 'admin']).indexOf(req.session.role) || -1 === restrictUpdate.indexOf(dir);
            if(!dir){
                fs.readdir('./data', (err, dirs) => {
                    if(dirs){
                        html += '<ul>';
                        dirs.forEach(v => {
                            if(viewable || -1 === restrictView.indexOf(v)){
                                html += '<li><a href="?dir=' + v + '">' + v + '</a></li>';
                            }
                        });
                        html += '</ul>';
                    }else{
                        html += '<p>暂无数据</p>';
                    }
                    if(updatable){
                        html += '<div style="position:fixed;right:20px;top:20px;"><form method="POST" style="display:inline;"><input type="hidden" name="action" value="add"><button type="submit" onclick="if(folderName = prompt(\'文件夹名\')){this.form.action = \'?dir=\' + folderName;}else{return false;}">添加</button></form></div>';
                    }
                    res.end(html);
                });
                return;
            }else{
                viewable = viewable || -1 === restrictView.indexOf(dir)
                if(!viewable){
                    res.statusCode = 403;
                    res.end();
                    break;
                }
            }
            let path = config.dir[dir] || './data/' + dir + '/';
            let name = url.parse(req.url, true).query.name;
            let script = '<script>setTimeout(function(){location.href = "$URL";}, 3000)</script>';
            if(name){
                let file = path + name;
                if('POST' === req.method){
                    if(!updatable){
                        res.statusCode = 403;
                        res.end();
                        return;
                    }
                    let body = [];
                    req.on('data', (chunk) => {
                        body.push(chunk);
                    });
                    req.on('end', () => {
                        body = Buffer.concat(body).toString();
                        let data = querystring.parse(body);
                        if('delete' === data.action){
                            fs.unlink(file, err => {
                                if(err){
                                    console.log(err);
                                    html += '<p>删除失败</p>';
                                    if(req.errorDebug){
                                        html += '<pre>' + err.stack + '</pre>';
                                    }else{
                                        html += script.replace('$URL', req.url);
                                    }
                                    html += '<body></html>';
                                    res.end(html);
                                }else{
                                    html += '<p>删除成功</p>';
                                    html += script.replace('$URL', req.url.replace((new RegExp('name=' + name)), ''));
                                    html += '<body></html>';
                                    res.end(html);
                                }
                            });
                        }else{
                            script = script.replace('$URL', req.url);
                            try{
                                data.content = JSON.stringify(JSON.parse(data.content));
                            }catch(e){
                            }
                            fs.writeFile(file, data.content, err => {
                                if(err){
                                    console.log(err);
                                    html += '<p>更新失败</p>';
                                    if(req.errorDebug){
                                        html += '<pre>' + err.stack + '</pre>';
                                    }else{
                                        html += script;
                                    }
                                    html += '<body></html>';
                                    res.end(html);
                                }else{
                                    html += '<p>更新成功</p>';
                                    html += script;
                                    html += '<body></html>';
                                    res.end(html);
                                }
                            });
                        }
                    });
                }else{
                    fs.readFile(file, 'utf8', (err, data) => {
                        if(err){
                            data = '';
                        }else{
                            try{
                                data = JSON.stringify(JSON.parse(data), null, '    ');
                            }catch(e){
                            }
                        }
                        html += '<form method="POST">';
                        let tags = ['<pre>', '</pre>']
                        if(updatable){
                            tags = ['<textarea name="content" style="width:100%;height:600px;">', '</textarea>'];
                        }
                        html += tags[0] + data.replace(/(\\r)?\\n/g, '\n').replace(/</g, '&lt;').replace(/>/g, '&gt;') + tags[1];
                        if(updatable){
                            html += '<input type="hidden" name="action" value="update" />';
                            html += '<button type="submit">更新</button>'
                        }
                        html += '</form>';
                        if(updatable){
                            html += '<div style="position:fixed;right:20px;top:20px;"><form method="POST"><input type="hidden" name="action" value="delete" /><button type="submit" onclick="return confirm(\'确定要删除吗？\')">删除</button></form></div>';
                        }
                        html += '<body></html>';
                        res.end(html);
                        return;
                    });
                }
            }else{
                if('POST' === req.method){
                    if(!updatable){
                        res.statusCode = 403;
                        res.end();
                        return;
                    }
                    let body = [];
                    req.on('data', (chunk) => {
                        body.push(chunk);
                    });
                    req.on('end', () => {
                        body = Buffer.concat(body).toString();
                        let data = querystring.parse(body);
                        if('delete' === data.action){
                            fs.rmdir(path, err => {
                                if(err){
                                    console.log(err);
                                    html += '<p>删除失败</p>';
                                    if(req.errorDebug){
                                        html += '<pre>' + err.stack + '</pre>';
                                    }else{
                                        html += script.replace('$URL', req.url);
                                    }
                                    html += '<body></html>';
                                    res.end(html);
                                }else{
                                    html += '<p>删除成功</p>';
                                    html += script.replace('$URL', '/develop/data/', '');
                                    html += '<body></html>';
                                    res.end(html);
                                }
                            });
                        }else if('add' === data.action){
                            fs.mkdir('./data/' + dir, err => {
                                if(err){
                                    html += '<p>添加失败</p>'
                                }else{
                                    html += '<p>添加成功</p>'
                                }
                                html += script.replace('$URL', '/develop/data/', '');
                                html += '<body></html>';
                                res.end(html);
                            });
                        }else{
                            res.statusCode = 403;
                            res.end();
                            return;
                        }
                    });
                }else{
                    fs.readdir(path, (err, files) => {
                        if(err){
                            console.log(err);
                            if(req.errorDebug){
                                html += err.stack;
                            }else{
                                html += '读取列表失败';
                            }
                            return;
                        }
                        html += '<table border="1" cellspacing="0" cellpadding="10"><tr><th>文件名</th><th>大小</th><th>创建时间</th><th>修改时间</th><th>操作</th></tr>';
                        let filesInfo = [];
                        files.forEach((v, i) => {
                            filesInfo.push(new Promise((resolve, reject) => {
                                fs.stat(path + v, (err, stats) => {
                                    if(err){
                                        reject(err);
                                    }else{
                                        stats.name = files[i];
                                        resolve(stats);
                                    }
                                });
                            }));
                        });
                        Promise.all(filesInfo).then(result => {
                            result.sort((v, w) => {
                                return w.mtime - v.mtime;
                            });
                            result.forEach((v) => {
                                html += '<tr><td>' + v.name + '</td><td>' + (v.size > 1024 ? (Math.round(v.size / 1024) + ' kb') : v.size + ' b') + '</td><td>' + v.birthtime + '</td><td>' + v.mtime + '</td><td><a href="?dir=' + dir + '&name=' + v.name + '">查看</a></td></tr>';
                            });
                            html += '</table>';
                            if(updatable){
                                html += '<div style="position:fixed;right:20px;top:20px;">';
                                if(result.length < 1){
                                    html += '<form style="display:inline;padding-right:10px;" method="POST" action="?dir=' + dir + '"><input type="hidden" name="action" value="delete"><button type="submit" onclick="return confirm(\'确定要删除吗？\')">删除</button></form>';
                                }
                                html += '<form style="display:inline;"><input type="hidden" name="dir" value="' + dir + '" /><input type="hidden" name="name"><button type="submit" onclick="if(fileName = prompt(\'文件名\')){this.form.name.value = fileName + (-1 !== fileName.indexOf(\'.\') ? \'\' : \'.json\');}else{return false;}">添加</button></form>';
                                html += '</div>';
                            }
                            html += '<body></html>';
                            res.end(html);
                        });
                    });
                }
            }
            break;
        case 'command':
            let commandList = [
                'npm install --no-save',
                'npm -v',
                'git status',
                'git diff',
                'git reset --hard',
                'git pull origin product',
                'git --version',
                'pm2 list',
                'pm2 restart nodeWx',
                'pm2 -v',
                'node -v',
                'ifconfig',
            ];
            if('POST' === req.method){
                let body = [];
                req.on('data', (chunk) => {
                    body.push(chunk);
                });
                req.on('end', () => {
                    body = Buffer.concat(body).toString();
                    let data = querystring.parse(body);
                    if(data.command){
                        if(-1 !== commandList.indexOf(data.command)){
                            require('child_process').exec(data.command, (error, stdout, stderr) => {
                                if(error){
                                    console.log(error);
                                    html += '<p>命令运行失败</p>' + '<pre>' + error.stack  + '</pre>';
                                    html += '<body></html>';
                                    res.end(html);
                                }else{
                                    html += '<p>命令运行成功</p>' + '<pre>' + 'Stdout' + '\n' + stdout.replace(/</g, '&lt') + (stderr ? 'Stderr' + '\n' + stderr.replace(/</g, '&lt') : '')  + '</pre>';
                                    html += '<body></html>';
                                    res.end(html);
                                }
                            });
                        }else{
                            html += '<p>命令非法</p>';
                            html += '<body></html>';
                            res.end(html);
                        }
                    }else{
                        html += '<p>命令缺失</p>';
                        html += '<body></html>';
                        res.end(html);
                    }
                });
            }else{
                html += '<form method="POST">';
                html += '<p><label>命令：</label><select name="command"><option>请选择</option>';
                commandList.forEach(v => {
                    html += '<option value="' + v + '">' + v + '</option>';
                });
                html += '</select>';
                html += '<p style="margin-left:3em;"><button type="submit">确认</button></p>';
                html += '<body></html>';
                res.end(html);
            }
            break;
        case 'mongo':
            restrictView = ['userId', 'permission', 'user', 'admin'];
            restrictUpdate = restrictView.concat(['message']);
            viewable = 'production' === process.env.NODE_ENV ? -1 !== ['super', 'admin'].indexOf(req.session.role) : true;
            updatable = -1 !== ('production' === process.env.NODE_ENV ? ['super'] : ['super', 'admin']).indexOf(req.session.role);
            mongo().then(db => {
                if(query.collection){
                    viewable = viewable || -1 === restrictView.indexOf(query.collection);
                    updatable = updatable || -1 === restrictUpdate.indexOf(query.collection);
                    if(!viewable){
                        res.statusCode = 403;
                        res.end();
                        return;
                    }
                    let search = {};
                    if('undefined' !== typeof query._id){
                        if('POST' === req.method){
                            if(!updatable){
                                res.statusCode = 403;
                                res.end();
                                return;
                            }
                            let body = [];
                            req.on('data', (chunk) => {
                                body.push(chunk);
                            });
                            req.on('end', () => {
                                body = Buffer.concat(body).toString();
                                let data = querystring.parse(body);
                                let script = '<script>setTimeout(function(){location.href = "/develop/mongo/?collection=' + query.collection + '";}, 3000)</script>';
                                if('delete' === data.action){
                                    db.collection(query.collection).deleteOne({_id: ObjectID(query._id)}, (err, result) => {
                                        if(err){
                                            console.log(err);
                                            return;
                                        }
                                        html += '<p>删除成功</p>' + script;
                                        res.end(html);
                                        return;
                                    });
                                    return;
                                }
                                let set;
                                try{
                                    set = JSON.parse(data.content);
                                }catch(e){
                                }
                                if(!set){
                                    html += '<p>格式错误</p>' + script;
                                    html += '</body></html>';
                                    res.end(html);
                                    return;
                                }
                                let search;
                                if(query._id){
                                    delete set._id;
                                    db.collection(query.collection).replaceOne({_id: ObjectID(query._id)}, set, (err, result) => {
                                        if(err){
                                            console.log(err);
                                            html += '<p>更新失败</p>' + script;
                                            html += '</body></html>';
                                            res.end(html);
                                            return;
                                        }
                                        html += '<p>更新成功</p>' + script;
                                        html += '</body></html>';
                                        res.end(html);
                                    });
                                }else{
                                    let method;
                                    if(Array.isArray(set)){
                                        method = 'insertMany';
                                        set.map(v => delete v._id);
                                    }else{
                                        method = 'insertOne';
                                        delete set._id;
                                    }
                                    db.collection(query.collection)[method](set, (err, result) => {
                                        if(err){
                                            console.log(err);
                                            html += '<p>添加失败</p>' + script;
                                            html += '</body></html>';
                                            res.end(html);
                                            return;
                                        }
                                        html += '<p>添加成功</p>' + script;
                                        html += '</body></html>';
                                        res.end(html);
                                    });
                                }
                            });
                        }else{
                            if(!viewable){
                                res.statusCode = 403;
                                res.end();
                                return;
                            }
                            db.collection(query.collection).findOne({_id: query._id ? ObjectID(query._id) : null}, (err, doc) => {
                                if(err){
                                    console.log(err);
                                    if(req.errorDebug){
                                        html += '<pre>' + err.stack  + '</pre>';
                                    }else{
                                        html += '<p>连接失败</p>';
                                    }
                                }else{
                                    doc = doc ? JSON.stringify(doc, null, '    ') : '';
                                    if(updatable){
                                        html += '<form method="POST">';
                                        html += '<textarea name="content" style="width:100%;height:600px;">' +  doc  + '</textarea>';
                                        html += '<button type="submit">' + (doc ? '更新' : '添加') + '</button></form>';
                                        html += '<div style="position:fixed;right:20px;top:20px;"><form method="POST"><input type="hidden" name="action" value="delete" /><button type="submit" onclick="return confirm(\'确定要删除吗？\')">删除</button></form></div>';
                                    }else{
                                        html += '<pre>' + doc + '</pre>';
                                    }
                                }
                                res.end(html);
                            });
                        }
                    }else{
                        db.collection(query.collection).find({}).toArray(function(err, docs) {
                            if(err){
                                console.log(err);
                                if(req.errorDebug){
                                    html += '<pre>' + err.stack  + '</pre>';
                                }else{
                                    html += '<p>连接失败</p>';
                                }
                            }else{
                                if(Array.isArray(docs) && docs.length > 0){
                                    html += '<table border="1" cellspacing="0" cellpadding="10" sytle="max-width:100%"><tr><th>内容</th><th>操作</th></tr>';
                                    docs.forEach(v => {
                                        html += '<tr><td style="word-break:break-all">' + JSON.stringify(v) + '</td><td><a href="?collection=' + query.collection + '&_id=' + v._id + '">查看</a></td></tr>';
                                    });
                                }else{
                                    html += '<p>暂无文档</p>';
                                }
                                if(updatable){
                                    html += '<div style="position:fixed;right:20px;top:20px;"><form><input type="hidden" name="collection" value="' + query.collection + '" /><input type="hidden" name="_id" /><button type="submit">添加</button></form></div>';
                                }
                            }
                            res.end(html);
                        });
                    }
                }else{
                    db.listCollections().toArray((err, clts) => {
                        if(err){
                            console.log(err);
                            if(req.errorDebug){
                                html += '<pre>' + err.stack  + '</pre>';
                            }else{
                                html += '<p>连接失败</p>';
                            }
                        }else{
                            if(Array.isArray(clts) && clts.length > 0){
                                html = '<ul>';
                                clts.forEach(v => {
                                    if(viewable || -1 === restrictView.indexOf(v.name)){
                                        html += '<li><a id="' + v.name + '" href="?collection=' + v.name + '">' + v.name + '</a></li>';
                                    }else{
                                        html += '<input type="hidden" id="' + v.name + '">';
                                    }
                                });
                                html += '</ul>';
                            }else{
                                html += '<p>暂无集合</p>';
                            }
                            html += '<div style="position:fixed;right:20px;top:20px;"><form><input type="hidden" name="collection" /><input type="hidden" name="_id"><button type="submit" onclick="if(collectionName = prompt(\'集合名\')){if(document.getElementById(collectionName)){alert(\'请输入非已有集合名\');return false;}this.form.collection.value = collectionName;alert(\'请添加文档\');}else{return false;}">添加</button></form></div>';
                        }
                        res.end(html);
                    });
                }
            }).catch(e => {
                if(req.errorDebug){
                    html += '<pre>' + e.stack  + '</pre>';
                }else{
                    html += '<p>连接失败</p>';
                }
                res.end(html);
            });
            break;
        default:
            res.statusCode = 403;
            res.end();
            break;
    }
};