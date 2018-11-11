'use strict'
const https = require('https');
const http = require('http');
const fs = require('fs');
const querystring = require('querystring');
const config = require('../config/common.json');
const common = require('./common');
const cache = require('./cache');
const mongo = require('./mongo');
const request = {
    request: (options) => {
        let option = {
            hostname: options.hostname ? options.hostname : config.api,
            path: options.path,
            method: options.method ? options.method : 'GET',
        }
        let postData;
        if('POST' === options.method){
            postData = 'object' === typeof options.postData ? JSON.stringify(options.postData) : options.postData;
            option.headers = {
                'Content-Type': 'application/json; charset=utf-8',
            }
        }
        let scheme = https;
        if(options.scheme && 'http' === options.scheme){
            scheme = http;
        }
        if(options.key){
            option.key = options.key;
            option.cert = options.cert;
        }
        if(options.headers){
            option.headers=options.headers;
        }
        const request = scheme.request(option, (respond) => {
            let result = [];
            respond.on('data', (chunk) => {
                result.push(chunk);
            });
            respond.on('end', () => {
                result = Buffer.concat(result);
                if(!respond.headers['content-type'] || !respond.headers['content-type'].match(/^image\/jpe?g/)){
                    result = result.toString();
                    if('xml' === options.dataType){
                        result = common.parseMessage(result);
                    }else{
                        try{
                            result = JSON.parse(result);
                        }catch(e){
                            result = {};
                        }
                    }
                }
                if('function' === typeof options.end){
                    options.end(result);
                }
            });
        });
        if('POST' === options.method){
            request.end(postData);
        }else{
            request.end();
        }
    },
    data: (req) => {
        return new Promise((resolve, reject) => {
            let body = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            req.on('end', () => {
                body = Buffer.concat(body).toString();
                resolve(querystring.parse(body));
            });
        });
    },
    getToken: (ticket) => {
        request.request({
            method: 'POST',
            postData: {
                component_appid: config.appid,
                component_appsecret: config.secret, 
                component_verify_ticket: ticket,
            },
            path: '/cgi-bin/component/api_component_token',
            end: function(result){
                if(result.component_access_token){
                    fs.writeFile(config.dir.cache + 'token.json', JSON.stringify(result), err => err && console.log(err));
                    request.refreshAppTokenAll(result.component_access_token);
                    request.sync('cache', 'token', result);
                }else{
                    console.log('result', result);
                }
            },
        });
    },
    getCode: (token, cb) => {
        request.request({
            method: 'POST',
            postData: {
                component_appid: config.appid,
            },
            path: '/cgi-bin/component/api_create_preauthcode?component_access_token=' + token,
            end: function(result){
                if('function' === typeof cb){
                    cb(result);
                }
            },
        });
    },
    getAuth: (token, code, cb) => {
        request.request({
            method: 'POST',
            postData: {
                component_appid: config.appid,
                authorization_code: code,
            },
            path: '/cgi-bin/component/api_query_auth?component_access_token=' + token,
            end: function(result){
                if(result.authorization_info){
                    let appid = result.authorization_info.authorizer_appid
                    let appFile = config.dir.cache + appid + '.json';
                    let appInfo = result;
                    let commit = common.require(config.dir.commit + appid + '.json');
                    if(commit){
                        fs.writeFile(appFile, JSON.stringify(appInfo), err => err && console.log(err) || cb(appid));
                        request.sync('cache', appid, appInfo);
                    }else{
                        request.info({appid: appid, token: token, appInfo: appInfo}).then(result => {
                            if('object' === typeof result.authorizer_info && result.authorizer_info.MiniProgramInfo){
                                request.setDomain(appInfo.authorization_info.authorizer_access_token);
                                request.commit({
                                    appid: appInfo.authorization_info.authorizer_appid,
                                    user_desc: '商城初始',
                                    appInfo: appInfo,
                                });
                                fs.writeFile(appFile, JSON.stringify(appInfo), err => err && console.log(err) || cb(appid));
                                request.sync('cache', appid, appInfo);
                            }else{
                                request.refreshTicket(appInfo, cb);
                            }
                        }).catch(error => fs.writeFile(appFile, JSON.stringify(appInfo), err => err && console.log(err) || cb(appid)));
                    }
                }else{
                    console.log('getAuth', result);
                    cb(null);
                }
            },
        });
    },
    getAuhorizer: (token) => {
        return new Promise((resolve, reject) => {
            request.request({
                method: 'POST',
                postData: {
                    component_appid: config.appid,
                    offset: 0,
                    count: 100,
                },
                path: '/cgi-bin/component/api_get_authorizer_list?component_access_token=' + token,
                end: function(result){
                    resolve(result);
                },
            });
        });
    },
    refreshAppToken: (token, appid, refreshToken) => {
        request.request({
            method: 'POST',
            postData: {
                component_appid: config.appid,
                authorizer_appid: appid,
                authorizer_refresh_token: refreshToken,
            },
            path: '/cgi-bin/component/api_authorizer_token?component_access_token=' + token,
            end: function(result){
                if(result.authorizer_access_token){
                    let appFile = config.dir.cache + appid + '.json';
                    let appInfo;
                    try{
                        appInfo = common.require(appFile);
                    }catch(e){
                        appInfo = {
                            authorization_info: {
                                authorizer_appid: appid,
                            },
                        };
                        console.log(e);
                    }
                    appInfo.authorization_info.authorizer_access_token = result.authorizer_access_token;
                    appInfo.authorization_info.expires_in = result.expires_in;
                    if('undefined' !== typeof appInfo.jssdk_info){
                        request.refreshTicket(appInfo);
                    }else{
                        fs.writeFile(appFile, JSON.stringify(appInfo), err => err && console.log(err));
                        request.sync('cache', appid, appInfo);
                    }
                }else{
                    console.log(result);
                }
            },
        });
    },

    refreshAppTokenAll: (token) => {
        request.getAuhorizer(token).then(function(result){
            if(result.list){
                for(let x in result.list){
                    request.refreshAppToken(token, result.list[x]['authorizer_appid'], result.list[x]['refresh_token']);
                }
            }else{
                console.log('getAuhorizer', result);
            }
        });
        const mini = require('../config/mini.json');
        for(let y in mini){
            request.refreshMiniToken(mini[y].appid, mini[y].secret);
        }
        
        const mp = require('../config/mp.json');
        for(let z in mp){
            request.refreshMiniToken(mp[z].appid, mp[z].secret,function (appInfo) {
                request.refreshBatchTicket(mp[z].appid,appInfo);
            });
        }

    },
    
    setDomain: (auth) => {
        request.request({
            method: 'POST',
            postData: {
                action: 'set',
                requestdomain: config.domain,
            },
            path: '/wxa/modify_domain?access_token=' + auth,
            end: function(result){
                if(0 !== result.errcode){
                    console.log('setDomain', result);
                }
            },
        });
    },
    sync: (dir, file, content) => {
        let url = config.sync[process.env.NODE_ENV];
        if(!url){
            return;
        }
        request.request({
            scheme: 'http',
            hostname: url,
            method: 'POST',
            postData: content,
            path: '/wx/sync/' + dir + '/?name=' + file,
            end: function(result){
                if('0000' !== result.ecode){
                    console.log('sync', result);
                }
            },
        });
    },
    commit: (data) => {
        let appid = data.appid
        let appFile = config.dir.cache + appid + '.json';
        let appInfo = data.appInfo;
        if(!appInfo){
            try{
                appInfo = common.require(appFile);
            }catch(e){
                console.log(e);
            }
        }
        let ext;
        try{
            ext = fs.readFileSync('./config/' + data.appid + '.json', 'utf-8');
        }catch(e){
            ext = JSON.stringify({
                extAppid: data.appid,
            });
        }
        if(!data.template_id){
            try{
                let commit = common.require(config.dir.cache + 'commit.json');
                if('string' === typeof commit.data){
                    commit.data = querystring.parse(commit.data);
                }
                data = Object.assign(commit.data, data);
            }catch(e){
                console.log(e);
            }
        }
        return new Promise((resolve, reject) => {
            if(appInfo && ext){
                let postData = {
                    template_id: data.template_id,
                    ext_json: ext,
                    user_version: data.user_version,
                    user_desc: data.user_desc
                };
                request.request({
                    method: 'POST',
                    postData: postData,
                    path: '/wxa/commit?access_token=' + appInfo.authorization_info.authorizer_access_token,
                    end: function(result){
                        if(0 === result.errcode){
                            fs.writeFile(config.dir.commit + appid + '.json', JSON.stringify({data: postData, result: result}), err => err && console.log(err));
                            resolve(appid);
                        }else{
                            console.log('commit', result);
                            reject({appid: appid, result: result});
                        }
                    },
                });
            }else{
                reject('AppInfo or Ext Error');
            }
        });
    },
    commitAll: (data, token) => {
        return new Promise((resolve, reject) => {
            request.getAuhorizer(token).then(function(result){
                let commits = [];
                if(result.list){
                    for(let x in result.list){
                        data.appid = result.list[x]['authorizer_appid'];
                        try{
                            fs.statSync(config.dir.commit + data.appid +'.json')
                            commits.push(request.commit(data));
                        }catch(e){
                        }
                    }
                    Promise.all(commits).then(result => {
                        resolve(result);
                    }).catch(result => {
                        reject(result);
                    });
                }else{
                    console.log('getAuhorizer', result);
                    reject(result);
                }
            });
        });
    },
    commitMulti: (data, token) => {
        if(!data.appids){
            data.appids = [data.appid];
        }
        let commits = [];
        if(-1 !== data.appids.indexOf(config.mainAppid)){
            data.appids = data.appids.concat(request.jacketsPublished());
        }
        data.appids.forEach(v => {
            data.appid = v;
            commits.push(request.commit(data));
        });
        return new Promise((resolve, reject) => {
            Promise.all(commits).then(result => {
                resolve(result);
            }).catch(result => {
                reject(result);
            });
        });
    },
    category: (token, cb) => {
        request.request({
            path: '/wxa/get_category?access_token=' + token,
            end: function(result){
                cb(result);
            },
        });
    },
    page: (token, cb) => {
        request.request({
            path: '/wxa/get_page?access_token=' + token,
            end: function(result){
                cb(result);
            },
        });
    },
    submitItem: (token, cb) => {
        let finalResult = {
            errcode: 0,
        };
        request.category(token, function(result){
            if(0 === result.errcode){
                finalResult.item = result.category_list[0] || {};
                request.page(token, function(result){
                    if(0 === result.errcode){
                        if(result['page_list']){
                            finalResult.item.address = result['page_list'][0];
                        }else{
                            console.log('page', result);
                        }
                        cb(finalResult);
                    }else{
                        console.log('page', result);
                        cb(result);
                    }
                });
            }else{
                console.log('category', result);
                cb(result);
            }
        });
    },
    submit: (data) => {
        let appid = data.appid;
        let appFile = config.dir.cache + appid + '.json';
        let appInfo;
        try{
            appInfo = common.require(appFile);
        }catch(e){
            console.log(e);
        }
        return new Promise((resolve, reject) => {
            if(appInfo){
                request.submitItem(appInfo.authorization_info.authorizer_access_token, function(result){
                    if(0 === result.errcode){
                        let item = result.item;
                        let ext;
                        try{
                            ext = require('../config/' + data.appid + '.json');
                        }catch(e){
                        }
                        if(ext && ext.window){
                            item.tag = ext.window.navigationBarTitleText;
                        }else{
                            item.tag = item.first_class;
                        }
                        item.title = "首页";
                        let postData = {
                            item_list: [item],
                        };
                        request.request({
                            method: 'POST',
                            postData: postData,
                            path: '/wxa/submit_audit?access_token=' + appInfo.authorization_info.authorizer_access_token,
                            end: function(result){
                                if(0 === result.errcode){
                                    resolve(appid + ': ' + result.auditid);
                                }else{
                                    reject(result);
                                }
                                fs.writeFile(config.dir.submit + appid + '.json', JSON.stringify({data: postData, result: result, autoPublish: 'true' === data.autoPublish}), err => err && console.log(err));
                            },
                        });
                    }else{
                        reject(result);
                    }
                });
            }else{
                reject('AppInfo Error');
            }
        });
    },
    submitMulti: (data) => {
        if(!data.appids){
            data.appids = [data.appid];
            if(-1 !== data.appids.indexOf(config.mainAppid)){
                data.appids = data.appids.concat(request.jacketsPublished());
            }
        }
        let submits = [];
        data.appids.forEach(v => {
            submits.push(request.submit({appid: v, autoPublish: data.autoPublish}));
        });
        return new Promise((resolve, reject) => {
            Promise.all(submits).then(result => {
                resolve(result);
            }).catch(result => {
                reject(result);
            });
        });
    },
    published: (appids) => {
        let published = [];
        appids.forEach(v => {
            try{
                let submit = common.require(config.dir.submit + v + '.json');
                if(submit && submit.published){
                    published.push(v);
                }
            }catch(e){
            }
        });
        return published;
    },
    jacketsPublished: () => {
        let jackets, published = [];
        try{
            jackets = common.require(config.dir.config + 'jackets.json');
        }catch(e){
        }
        if(jackets){
            published = request.published(jackets);
        }
        return published;
    },
    status: (data, format) => {
        let appFile = config.dir.cache + data.appid + '.json';
        let appInfo;
        try{
            appInfo = common.require(appFile);
        }catch(e){
            console.log(e);
        }
        let path, postData, method;
        if(data.aid){
            path = '/wxa/get_auditstatus?access_token=';
            postData = {
                auditid: data.aid,
            }
            method = 'POST';
        }else{
            path = '/wxa/get_latest_auditstatus?access_token=';
            postData = {};
            method = 'GET';
        }
        return new Promise((resolve, reject) => {
            if(appInfo){
                request.request({
                    method: method,
                    postData: postData,
                    path: path + appInfo.authorization_info.authorizer_access_token,
                    end: function(result){
                        if(format){
                            const labels = {
                                '-1': '未发布',
                                '0': '审核通过',
                                '1': '审核失败',
                                '2': '审核中',
                                '3': '已发布',
                            }
                            let reason = '', status;
                            if(0 === result.errcode){
                                status = result.status.toString();
                                if(1 === result.status){
                                    reason = '，' + result.reason;
                                }
                                if(0 === result.status){
                                    let submit = common.require(config.dir.submit + data.appid + '.json');
                                    if(submit && (submit.result && 0 !== submit.result.errcode || submit.published) || !submit){
                                        status = '3';
                                    }
                                }
                            }else if(85058 === result.errcode){
                                status = '-1';
                            }
                            resolve({
                                value: status,
                                label: labels[status] + reason
                            });
                        }else{
                            resolve(result);
                        }
                    },
                });
            }else{
                reject('AppInfo Error');
            }
        });
    },
    publish: (data, cb) => {
        let appid = data.appid;
        let appFile = config.dir.cache + appid + '.json';
        let appInfo;
        try{
            appInfo = common.require(appFile);
        }catch(e){
            console.log(e);
        }
        if(appInfo){
            request.request({
                method: 'POST',
                postData: {},
                path: '/wxa/release?access_token=' + appInfo.authorization_info.authorizer_access_token,
                end: function(result){
                    cb(result);
                    let submitFile = config.dir.submit + appid + '.json';
                    let submit = common.require(submitFile);
                    submit.published = true;
                    fs.writeFile(submitFile, JSON.stringify(submit), (err) => {
                        if(err){
                            console.log(err);
                        }
                    });
                    fs.writeFile(config.dir.publish + appid + '.json', JSON.stringify({data: data, result: result}), err => err && console.log(err));
                },
            });
        }else{
            cb({});
        }
    },
    getBeta: (appid) => {
        let appFile = config.dir.cache + appid + '.json';
        let appInfo;
        try{
            appInfo = common.require(appFile);
        }catch(e){
            console.log(e);
        }
        return new Promise((resolve, reject) => {
            if(appInfo){
                request.request({
                    path: '/wxa/get_qrcode?access_token=' + appInfo.authorization_info.authorizer_access_token,
                    proxy: true,
                    end: function(result){
                        resolve(result);
                    },
                });
            }else{
                reject('AppInfo Error');
            }
        });
    },
    login: (code) => {
        let user;
        return new Promise((resolve, reject) => {
            request.request({
                path: '/sns/oauth2/access_token?appid=' + config.login.appid + '&secret=' + config.login.secret + '&code=' + code + '&grant_type=authorization_code',
                end: (result) => {
                    if(result.access_token && result.openid){
                        user = result;
                        mongo().then(db =>{
                            const collection = db.collection('user');
                            let search = {openid: result.openid};
                            collection.findOne(search, (err, doc) => {
                                if(err){
                                    reject(err);
                                    return;
                                }
                                user.timestamp = new Date();
                                if(doc && doc.unionid){
                                    collection.updateOne(search, {$set: user}, err => {
                                        err ? reject(err): resolve(doc);
                                    });
                                }else{
                                    request.request({
                                        path: '/sns/userinfo?access_token=' + result.access_token + '&openid=' + result.openid,
                                        end: (result) => {
                                            if(!result.errcode){
                                                Object.assign(user, result);
                                                collection.findOneAndUpdate({unionid: user.unionid}, {$set: user}, {upsert: true, returnOriginal: false}, (err, result) => {
                                                    err ? reject(err): resolve(result.value);
                                                });
                                            }else{
                                                reject(new Error(JSON.stringify(result)));
                                            }
                                        },
                                    });
                                }
                            });
                        }).catch(e => {
                            reject(e);
                        })
                    }else{
                        reject(new Error(JSON.stringify(result)));
                    }
                },
            });
        });
    },
    info: (data) => {
        let appid = data.appid
        let appFile = config.dir.cache + appid + '.json';
        let appInfo = data.appInfo;
        if(!appInfo){
            try{
                appInfo = common.require(appFile);
            }catch(e){
                console.log(e);
            }
        }
        return new Promise((resolve, reject) => {
            if(appInfo){
                request.request({
                    method: 'POST',
                    postData: {
                        component_appid: config.appid,
                        authorizer_appid: data.appid,
                    },
                    path: '/cgi-bin/component/api_get_authorizer_info?component_access_token=' + data.token,
                    end: function(result){
                        if(result.authorizer_info){
                            if(data.status && 'object' === typeof result.authorizer_info.MiniProgramInfo){
                                request.status({appid: appid}, true).then(status => {
                                    result.status = status;
                                    resolve(result);
                                });
                            }else{
                                resolve(result);
                            }
                        }else{
                            console.log('info', result);
                            reject(result);
                        }
                    },
                });
            }else{
                reject('AppInfo Error');
            }
        });
    },
    notifyTemplate: appid => {
        let appFile = config.dir.cache + appid + '.json';
        let appInfo;
        try{
            appInfo = common.require(appFile);
        }catch(e){
        }
        return new Promise((resolve, reject) => {
            if(appInfo){
                request.request({
                    method: 'POST',
                    postData: {
                        "offset": 0,
                        "count": 10,
                    },
                    path: '/cgi-bin/wxopen/template/list?access_token=' + appInfo.authorization_info.authorizer_access_token,
                    end: function(result){
                        resolve(result);
                    },
                });
            }else{
                reject('AppInfo Error');
            }
        });
    },
    notify: data => {
        let appFile = config.dir.cache + data.appid + '.json';
        let appInfo;
        try{
            appInfo = common.require(appFile);
        }catch(e){
        }
        delete data.appid;
        return new Promise((resolve, reject) => {
            if(appInfo){
                request.request({
                    method: 'POST',
                    postData: data,
                    path: '/cgi-bin/message/wxopen/template/send?access_token=' + appInfo.authorization_info.authorizer_access_token,
                    end: function(result){
                        resolve(result);
                    },
                });
            }else{
                reject('AppInfo Error');
            }
        });
    },
    template: (token) => {
        return new Promise((resolve, reject) => {
            request.request({
                path: '/wxa/gettemplatelist?access_token=' + token,
                end: result => {
                    if(0 === result.errcode){
                        if(Array.isArray(result.template_list) && result.template_list.length > 0){
                            resolve(result.template_list);
                        }else{
                            reject('No Template');
                        }
                    }else{
                        reject(result);
                    }
                }
            })
        });
    },
    refreshTicket: (appInfo, cb) => {
        let appid = appInfo.authorization_info.authorizer_appid;
        let appFile = config.dir.cache + appid + '.json';
        request.request({
            path: '/cgi-bin/ticket/getticket?access_token=' + appInfo.authorization_info.authorizer_access_token + '&type=jsapi',
            end: result => {
                if(0 === result.errcode){
                    appInfo['jssdk_info'] = {
                        ticket: result.ticket,
                        'expires_in': result.expires_in
                    }
                }else{
                    console.log(result.errcode);
                }
                fs.writeFile(appFile, JSON.stringify(appInfo), err => err && console.log(err) || cb && cb(appid));
                request.sync('cache', appid, appInfo);
            },
        });
    },
};

module.exports = request;