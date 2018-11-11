const common = require('./common');
module.exports = function(){
    const MongoClient = require('mongodb').MongoClient;
    const configDefault = {
        'host': 'localhost',
        'port': '27017',
        'user': '',
        'password': '',
        'database': 'wechatThird'
    }
    let config = Object.assign({}, configDefault, common.require('./data/config/mongo.json'));
    const url = 'mongodb://' + (config.user ? encodeURIComponent(config.user) + ':' + encodeURIComponent(config.password) + '@' : '') + config.host + ':' + config.port + '/' + config.database;
    return new Promise((resolve, reject) => {
        if(global.db){
            resolve(db);
            return;
        }
        MongoClient.connect(url, function(err, client) {
            if(err){
                console.log(err);
                reject(err);
            }else{
                global.db = client.db();
                resolve(db);
            }
        });
    });
};