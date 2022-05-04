const ccxt = require('ccxt');
const fs = require('fs');

import config from './config.json';

const MarketList = config.MarketList;
const TickerException = config.Ticker_Exception;

let Fetched_Tickers = {};
let Tickers_in_MarketList = {};
let Symbol_List = {};
let Refined_Tickers = {};

main();

async function main() {
    await initialize();
    await GetTickersInMarketList();
    //await WriteAllTickers();
    await GetSymbolList();
    await DeleteOneMarketSymbol();
    await GetTickersBySymbol();
    debuglog(Refined_Tickers);
}

async function initialize() {
    //console.log(ccxt.exchanges);
    console.log('MarketList:', MarketList);
    console.log('Ticker Exception : ', TickerException);

    for (let key in MarketList) {
        await GetTickers(key);
    }
}

async function GetTickers(key){
    try{
        const exchange = new ccxt[key]();
        const tickers = await exchange.fetch_tickers();
        Fetched_Tickers[key] = tickers;
    }
    catch(e){
        console.log('Get Tickers Error:', e);
    }
}

async function WriteAllTickers(){
    let file = './tickers.json'
    let data = JSON.stringify(Tickers_in_MarketList, null, 2);
    fs.writeFileSync(file, data);
}

async function GetTickersInMarketList(){
    for(let key in MarketList){
        let tickers = Fetched_Tickers[key];
        let ticker_data = {};
        for(let ticker in tickers){
            let tickername = ticker;
            let tickermarket = tickername.split('/')[1];
            if(tickermarket == MarketList[key]){
                ticker_data[tickername] = Fetched_Tickers[key][ticker];
            }
        }
        Tickers_in_MarketList[key + "_" + MarketList[key]] = ticker_data;
    }
}

async function GetSymbolList(){
    for(let key in Tickers_in_MarketList){
        let exchange = key.split('_')[0];
        let market = key.split('_')[1];
        let market_data = Tickers_in_MarketList[key];

        for(let ticker in market_data){
            let ticker_data = market_data[ticker];
            let ticker_symbol = ticker_data['symbol'];
            let ticker_base = ticker_symbol.split('/')[0];

            if(Symbol_List[ticker_base] == undefined)
                Symbol_List[ticker_base] = [exchange + "_" + market,];

            else
                Symbol_List[ticker_base].push(exchange + "_" + market);
            
        }
    }
}

async function DeleteOneMarketSymbol(){
    for(let key in Symbol_List){
        if(Symbol_List[key].length == 1){
            delete Symbol_List[key];
        }
    }
}

async function GetTickersBySymbol(){
    for(let key in Symbol_List)
        Refined_Tickers[key] = {};
    for(let exchange in MarketList){
        let tickers = Fetched_Tickers[exchange];
        for(let symbol in Symbol_List){
            if(Symbol_List[symbol].includes(exchange + "_" + MarketList[exchange])){
                if(Refined_Tickers[symbol][exchange + "_" + MarketList[exchange]] == undefined)
                    Refined_Tickers[symbol][exchange + "_" + MarketList[exchange]] = tickers[symbol + "/" + MarketList[exchange]]['close'];
                
                else
                    Refined_Tickers[symbol][exchange + "_" + MarketList[exchange]].push(tickers[symbol + "/" + MarketList[exchange]]['close']);
            }
        }
    }
}

async function debuglog(str){
    console.log(str);
}


/*
let exchange = new ccxt['binance']();
exchange.fetchTicker('BTC/USDT').then(ticker => {
    console.log('binance', ticker);
}).catch(err => {
    console.log(err);
});
*/