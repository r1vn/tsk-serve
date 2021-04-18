'use strict' // 2021-04-13 01.48

const { RXFS } = require('./util/rxfs')

module.exports = function tsk_serve (cfg)
{
    new RXFS(cfg)
}