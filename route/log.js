'use strict'
const url = require('url');
const fs = require('fs');
const config = require('../config/common.json');
const common = require('../func/common');
module.exports = (req, res, act) => {
    res.statusCode = 204;
    res.end();
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
            if('object' === typeof data && 'object' === typeof data.systemInfo && 'devtools' === data.systemInfo.platform){
                return;
            }
            let time = common.getTime();
            let name = act + time.year + time.month + time.date;
            let filePath = config.dir.log + name + '.json';
            fs.readFile(filePath, (err, records) => {
                if(err){
                    records = {};
                }else{
                    try{
                        records = JSON.parse(records);
                    }catch(e){
                        records = {};
                    }
                }
                records['' + time.hour + time.minute + time.second + time.milliSecond] = data;
                fs.writeFile(filePath, JSON.stringify(records), err => err && console.log(err));
            });
        });
    }
};