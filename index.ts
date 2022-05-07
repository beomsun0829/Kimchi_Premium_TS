const ccxt = require('ccxt');
const fs = require('fs');

import config from './config.json';

const MarketList = config.MarketList;
const TickerException = config.Ticker_Exception;

console.log("-----------------------------------------------------");
console.log('MarketList:', MarketList);
console.log('Ticker Exception : ', TickerException);

let Fetched_Tickers = {};
let Tickers_in_MarketList = {};
let Symbol_List = {};
let Refined_Tickers = {};

let tether_price = -1;

loop();

async function loop(){
    while(true){
        await main();
        console.log("-----------------------------------------------------");
    }
}

async function main() {
    await initialize();
    await GetTickersInMarketList();
    //await WriteAllTickers();
    await GetSymbolList();
    await DeleteOneMarketSymbol();
    await GetTickersBySymbol();
    await GetTetherPrice();
    await CalcKrwToTether();
    await CalcPremium();

}

async function initialize() {
    //console.log(ccxt.exchanges);

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
                if(tickers[symbol + "/" + MarketList[exchange]]['close'] == 0)
                    continue;

                if(Refined_Tickers[symbol][exchange + "_" + MarketList[exchange]] == undefined)
                    Refined_Tickers[symbol][exchange + "_" + MarketList[exchange]] = tickers[symbol + "/" + MarketList[exchange]]['close'];
                
                else
                    Refined_Tickers[symbol][exchange + "_" + MarketList[exchange]].push(tickers[symbol + "/" + MarketList[exchange]]['close']);
            }
        }
    }
}

async function GetTetherPrice(){
    tether_price = Refined_Tickers['BTC']['upbit_KRW'] / Refined_Tickers['BTC']['binance_USDT']
    console.log('Tether Price:', tether_price);
}

async function CalcKrwToTether(){
    if(tether_price == -1){
        console.log('Tether Price is not found');
    }

    for(let symbol in Refined_Tickers){
        for(let index in Refined_Tickers[symbol]){
            let market = index.split('_')[1];
            if(market == 'KRW')
                Refined_Tickers[symbol][index] = Refined_Tickers[symbol][index] / tether_price;
        }
    }
}

function CalcPremium(){
    for(let symbol in Refined_Tickers){
        if(CheckSymbolException(symbol))
            continue;

        let maxval : number = Math.max.apply(null, Object.values(Refined_Tickers[symbol]));
        let maxindex = Object.keys(Refined_Tickers[symbol]).find(key => Refined_Tickers[symbol][key] === maxval);
        let minval : number = Math.min.apply(null, Object.values(Refined_Tickers[symbol]));
        let minindex = Object.keys(Refined_Tickers[symbol]).find(key => Refined_Tickers[symbol][key] === minval);
        let premium : number = ((maxval / minval) - 1 ) * 100;

        //debuglog("debug : " + symbol + " : " + maxval + " : " + minval + " : " + premium);


        if(Math.abs(premium) > 5){
            console.log(symbol + " | 5% 이상 차이 " + "( " + premium.toFixed(3) + " % )" + " | " + minindex + " -> " + maxindex);
        }

        else if(Math.abs(premium) > 3){
            console.log(symbol + " | 3% 이상 차이 " + "( " + premium.toFixed(3) + " % )" + " | " + minindex + " -> " + maxindex);
        }
        
    }
}

function CheckSymbolException(symbol){
    if(TickerException.includes(symbol))
        return true;
    else
        return false;
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