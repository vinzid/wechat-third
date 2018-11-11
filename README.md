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

5. 运行 Node.js服务  
>node app  

6. 访问站点  
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