## 安装

0. 安装软件
>[Git][git]  
[Node][node]  
[Nginx][nginx]  
[mongoDB][mongoDB]  

1. 拉取代码
>git clone https://github.com/vinzid/wechat-third.git && cd wechat-third

2. 安装依赖
>npm i --no-save

3. 启动 mongoDB
>"C:/Program Files/MongoDB/Server/3.6/bin/mongod.exe"

4. 添加初始数据
>"C:/Program Files/MongoDB/Server/3.6/bin/mongo.exe"
```
    use wechatThird
    db.permission.insertMany([
        {"type":"notify","act":"*","anonym":true},
        {"type":"user","act":"logout","title":"退出","menu":true,"order":1000}
    ])
```

5. 添加配置文件（config/common.json）
```
 {
    "token": "TOKEN",
    "key": "KEY",
    "appid": "APPID",
    "secret": "SECRET",
    "api": "api.weixin.qq.com",
    "cache": "-P PORT user@ip:/PATH/TO/CACHE",
    "domain": ["DOMAIN1", "DOMAIN2"],
    "sync": {
        "testing": "PRODUCTION_DOMAIN",
        "production": "TESTING_DOMAIN"
    },
    "dir": {
        "cache": "./data/cache/",
        "config": "./data/config/",
        "session": "./data/session/",
        "message": "./data/message/",
        "commit": "./data/commit/",
        "submit": "./data/submit/",
        "audit": "./data/audit/",
        "publish": "./data/publish/",
        "log": "./data/log/",
        "qrcode": "./data/qrcode/",
        "notify": "./data/notify/",
        "beta": "./data/beta/"
    },
    "notifyEnv": "production",
    "notifyTest": "TESTING_DOMAIN",
    "login": {
        "appid": "APPID",
        "secret": "SECRET",
        "domain": "DOMAIN"
    },
    "service": {
        "key": "KEY",
        "secret": "SECRET"
    },
    "mainAppid": "MAIN_APPID",
    "ip": {
        "development": "DEVELOPMENT_IP",
        "testing": "TESTING_IP",
        "production": "PRODUCTION_IP"
    }
}
```

6. 运行 Node.js服务  
>node app  

7. 访问站点  
>http://localhost:9031/  


## 目录结构

    /  根目录  
    app.js  程序入口  
    package.json  站点信息  
    Readme.md  说明文档  
    .gitignore  git 忽略文件  

    config/  配置  

    data/  数据  

    func/ 公共方法  

    routes/  接口路由  

    fe/  展示路由  



[git]: https://git-scm.com/
[node]: https://nodejs.org/
[nginx]: http://nginx.org/
[mongoDB]: https://www.mongodb.com/