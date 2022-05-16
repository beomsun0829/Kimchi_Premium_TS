const ccxt = require('ccxt');
const fs = require('fs');

import config from './config.json';

const MarketList = config.MarketList;
const TickerException = config.Ticker_Exception;
const ExchangePairException = config.ExchangePair_Exception;
const ExchangeTickerException = config.Exchange_Ticker_Exception;

console.log("-----------------------------------------------------");
console.log('MarketList:', MarketList);
console.log('Ticker Exception : ', TickerException);
console.log('Exchange Pair Exception:', ExchangePairException);
console.log('Exchange Ticker Exception:', ExchangeTickerException);

let Fetched_Tickers = {};
let Tickers_in_MarketList = {};
let Symbol_List = {};
let Refined_Tickers = {};
let Premium_Sorter = [];

let tether_price = -1;

loop();

async function loop(){
    while(true){
        await main();
        console.log("-----------------------------------------------------");
    }
}

async function main() {
    try{
        await initialize();
        await GetTickersInMarketList();
        //await WriteAllTickers();
        await GetSymbolList();
        await DeleteSeveralMarkets();
        await DeleteOneMarketSymbol();
        await GetTickersBySymbol();
        await GetTetherPrice();
        await CalcMarketToTether();
        await CalcPremium();
        await SortPremium();
        await PrintPremium();
    }
    catch(e){
        console.log(`Error while loop : ${e}`);
    }
}

async function initialize() {
    //console.log(ccxt.exchanges);
    Premium_Sorter = [];

    for (let index = 0; index < MarketList.length; index++) {
        await GetTickers(MarketList[index][0]);
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
    for(let index = 0; index < MarketList.length; index++){
        let tickers = Fetched_Tickers[MarketList[index][0]];
        let ticker_data = {};
        for(let ticker in tickers){
            let tickername = ticker;
            let tickermarket = tickername.split('/')[1];
            if(tickermarket == MarketList[index][1]){
                ticker_data[tickername] = Fetched_Tickers[MarketList[index][0]][ticker];
            }
        }
        Tickers_in_MarketList[MarketList[index][0] + "_" + MarketList[index][1]] = ticker_data;
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

function DeleteSeveralMarkets(){
    for(let key in Symbol_List){
        if(Symbol_List[key].includes('upbit_KRW') && Symbol_List[key].includes('upbit_BTC')){
            Symbol_List[key].splice(Symbol_List[key].indexOf('upbit_BTC'), 1);
        }
        else if(Symbol_List[key].includes('binance_USDT') && Symbol_List[key].includes('binance_BTC')){
            Symbol_List[key].splice(Symbol_List[key].indexOf('binance_BTC'), 1);
        }
        else if(Symbol_List[key].includes('binance_BUSD') && Symbol_List[key].includes('binance_USDT')){
            Symbol_List[key].splice(Symbol_List[key].indexOf('binance_USDT'), 1);
        }
        else if(Symbol_List[key].includes('binance_USDT') && Symbol_List[key].includes('binance_BUSD')){
            Symbol_List[key].splice(Symbol_List[key].indexOf('binance_BUSD'), 1);
        }
    }
}

function DeleteOneMarketSymbol(){
    for(let key in Symbol_List){
        if(Symbol_List[key].length == 1){
            delete Symbol_List[key];
        }
    }
}

async function GetTickersBySymbol(){
    for(let key in Symbol_List)
        Refined_Tickers[key] = {};

    for(let index = 0; index < MarketList.length; index++){
        let exchange = MarketList[index][0];
        let market = MarketList[index][1];
        let tickers = Fetched_Tickers[exchange];
        for(let symbol in Symbol_List){
            if(Symbol_List[symbol].includes(exchange + "_" + market)){

                if(tickers[symbol + "/" + market]['close'] == 0)
                    continue;
                
                if(CheckExchangeTickerException(exchange, symbol))
                    continue;

                if(tickers[symbol + "/" + market]['close'] == undefined){
                    console.log("Error : failure to fetch | " + exchange + "_" + market + " : " + symbol);
                    continue;
                }

                if(Refined_Tickers[symbol][exchange + "_" + market] == undefined)
                    Refined_Tickers[symbol][exchange + "_" + market] = tickers[symbol + "/" + market]['close'];
                
                else
                    Refined_Tickers[symbol][exchange + "_" + market].push(tickers[symbol + "/" + market]['close']);
            }
        }
    }
}

async function GetTetherPrice(){
    tether_price = Refined_Tickers['BTC']['upbit_KRW'] / Refined_Tickers['BTC']['binance_USDT']
    console.log('Tether Price:', tether_price.toFixed(3));
}

function CalcMarketToTether(){
    if(tether_price == -1){
        console.log('Tether Price is not found');
    }

    for(let symbol in Refined_Tickers){
        for(let index in Refined_Tickers[symbol]){
            let market = index.split('_')[1];
            if(market == 'KRW')
                Refined_Tickers[symbol][index] = Refined_Tickers[symbol][index] / tether_price;
            if(market == 'BTC')
                Refined_Tickers[symbol][index] = Refined_Tickers[symbol][index] * Refined_Tickers['BTC']['binance_USDT'];
        }
    }
}

function CalcPremium(){
    for(let symbol in Refined_Tickers){
        if(CheckSymbolException(symbol))
            continue;

        //debuglog(Refined_Tickers[symbol]);

        if(Object.keys(Refined_Tickers[symbol]).length < 2)
            continue;

        let index = [];
        for (let x in Refined_Tickers[symbol]){
            index.push([x, Refined_Tickers[symbol][x]]);
        }
        
        for(let i = 0; i < index.length; i++){
            for(let j = 0; j < index.length; j++){
                if(CheckExchangePairException(index[i][0].split('_')[0], index[j][0].split('_')[0]))
                    continue;

                if(index[i][0] == index[j][0])
                    continue;

                let premium = ((index[i][1] / index[j][1]) - 1) * 100;

                if(premium < 0)
                    continue;
                
                if(Math.abs(premium) >= 3){
                    Premium_Sorter.push([
                        premium.toFixed(3),
                        `${symbol} | ${premium.toFixed(3)}% | ${index[j][0].toUpperCase()} -> ${index[i][0].toUpperCase()}`,
                    ])
                }
            }
        }
    }
    //debuglog(Premium_Sorter);
}

function SortPremium(){
    Premium_Sorter.sort(function(a, b){
        return b[0] - a[0];
    }
    );
}

function PrintPremium(){
    for(let i = 0; i < Premium_Sorter.length; i++){
        console.log(Premium_Sorter[i][1]);
    }
}

function CheckSymbolException(symbol){
    if(TickerException.includes(symbol))
        return true;
    else
        return false;
}

function CheckExchangePairException(fromexchange, toexchange){
    fromexchange = fromexchange.split('_')[0];
    toexchange = toexchange.split('_')[0];
    for(let i in ExchangePairException){
        if(ExchangePairException[i][0] == fromexchange && ExchangePairException[i][1] == toexchange)
            return true;
    }
    return false;
}

function CheckExchangeTickerException(exchange, ticker){
    if(ExchangeTickerException[exchange] == undefined)
        return false;
    
    if(ExchangeTickerException[exchange].includes(ticker))
        return true;

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