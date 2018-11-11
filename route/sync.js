'use strict'
const url = require('url');
const fs = require('fs');
const config = require('../config/common.json');
module.exports = (req, res, act) => {
    if(req.admin && 'POST' === req.method){
        let body = [];
        req.on('data', (chunk) => {
            body.push(chunk);
        });
        req.on('end', () => {
            let query = url.parse(req.url, true).query;
            body = Buffer.concat(body).toString();
            fs.writeFile('./data/' + act + '/' + query.name + '.' + (-1 !== query.name.indexOf('.') ? '' : 'json'), body, (err) => {
                if(err){
                    console.log(err);
                    res.end('\n' + 'Failure' + '\n');
                }else{
                    res.end('\n' + 'Success' + '\n');
                }
            });
        });
    }else{
        res.statusCode = 403;
        res.end();
    }
}