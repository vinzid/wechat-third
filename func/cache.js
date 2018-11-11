'use strict'
const config = require('../config/common.json');
const common = require('./common');
const cache = {
    ticket: () => {
        let ticket;
        try{
            let ticketCached = common.require(config.dir.cache + 'ticket.json');
            if(ticketCached){
                ticket = ticketCached.ComponentVerifyTicket;
            }
        }catch(e){
            console.log(e);
        }
        return ticket;
    },
    token: () => {
        let token;
        try{
            let tokenCached = common.require(config.dir.cache + 'token.json');
            if(tokenCached){
                token = tokenCached.component_access_token;
            }
        }catch(e){
            console.log(e);
        }
        return token;
    },
};
module.exports = cache;