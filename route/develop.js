'use strict'
const url = require('url');
const fs = require('fs');
const request = require('../func/request');
const config = require('../config/common.json');
const common = require('../func/common');
module.exports = (req, res, act) => {
    switch(act){
        case 'commit':
            if(req.admin && 'POST' === req.method){
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
                        res.end('\n' + 'Failure' + '\n');
                    }
                    let method = 'commitAll';
                    if(data.appid){
                        if(config.mainAppid === data.appid){
                            method = 'commitMulti';
                        }else{
                            method = 'commit';
                        }
                    }
                    request[method](data, req.token).then(result =>{
                        res.end('\n' + 'Commit ' + result.toString() + ' Success' + '\n');
                        fs.writeFile(config.dir.cache + 'commit.json', JSON.stringify({data: JSON.parse(body), result: result}), err => err && console.log(err));
                    }).catch(result => {
                        console.log(result);
                        res.end('\n' + JSON.stringify(result) + '\n');
                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'submit':
            if(req.admin && 'POST' === req.method){
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
                    request.submitMulti(data).then(result => {
                        let output = '\n';
                        result.forEach(v => {
                            output += v + '\n';
                        });
                        res.end(output);
                    }).catch(result => {
                        console.log(result);
                        res.end('\n' + JSON.stringify(result) + '\n');

                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'status':
            if(req.admin && 'POST' === req.method){
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
                    request.status(data).then(result => {
                        if(0 === result.errcode){
                            res.end('\n' + 'status: ' + result.status + (1 === result.status ? ', ' + result.reason : '') + '\n');
                        }else{
                            res.end('\n' + JSON.stringify(result) + '\n');
                        }
                    }).catch(result => {
                        console.log(result);
                        res.end('\n' + result + '\n');
                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'publish':
            if(req.admin && 'POST' === req.method){
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
                    request.publish(data, function(result){
                        if(0 === result.errcode){
                            res.end('\n' + 'Success' + '\n');
                        }else{
                            console.log(result);
                            res.end('\n' + JSON.stringify(result) + '\n');
                        }
                    });
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'data':
            if(req.admin && 'POST' === req.method){
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
                    try{
                        fs.readFile('./data/' + data.dir + '/' + data.name + '.json', 'utf8', function(err, data){
                            if(err){
                                res.end('\n' + err.stack + '\n');
                            }else{
                                res.end('\n' + data + '\n');
                            }
                        });
                    }catch(e){
                        console.log(e);
                        res.end('\n' + e.stack + '\n');
                    }
                    
                });
            }else{
                res.statusCode = 403;
                res.end();
            }
            break;
        case 'ext':
            let appid = url.parse(req.url, true).query.appid;
            if(!appid){
                appid = config.mainAppid;
            }
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            let ext;
            try{
                ext = require('../config/' + appid + '.json');
            }catch(e){
                ext = {
                    "extEnable": true,
                    "extAppid": appid,
                };
            }
            res.end(JSON.stringify(ext, null, '    '));
            break;
        case 'npm':
            if(req.admin && 'POST' === req.method){
                require('child_process').exec('npm install --no-save', (error, stdout, stderr) => {
                    if(error){
                        console.log(error);
                        res.end('\n' + 'Failure' + '\n' + error.stack + '\n');
                    }else{
                        res.end('\n' + 'Success' + '\n' + 'Stdout' + '\n' + stdout + (stderr ? 'Stderr' + '\n' + stderr : '') + '\n');
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