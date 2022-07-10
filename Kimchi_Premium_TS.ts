const ccxt = require('ccxt');
const fs = require('fs');
require('dotenv').config();

import config from './config.json';

const Use_Telegram = config.Use_Telegram;
const Use_CheckWithdrawable = true;
const MarketList = config.MarketList;
const TickerException = config.Ticker_Exception;
const ExchangePairException = config.ExchangePair_Exception;
const ExchangeTickerException = config.Exchange_Ticker_Exception;

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_TOKEN;
let bot = undefined;

if(Use_Telegram){
    bot =  new TelegramBot(token, {polling: true});
}

console.log("-----------------------------------------------------");
console.log('MarketList:', MarketList);
console.log('Ticker Exception :', TickerException);
console.log('Exchange Pair Exception :', ExchangePairException);
console.log('Exchange Ticker Exception :', ExchangeTickerException);
console.log('Telegram :', Use_Telegram);

let Market_Data = {};
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

    /*
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
        if(e == 'TypeError: Cannot read property \'close\' of undefined'){
            console.log(Fetched_Tickers)
        }
    }
    */
}

async function initialize() {
    Market_Data = {};
    Fetched_Tickers = {};
    Tickers_in_MarketList = {};
    Symbol_List = {};
    Refined_Tickers = {};
    Premium_Sorter = [];
    tether_price = -1;

    for (let index = 0; index < MarketList.length; index++) {
        if(Fetched_Tickers[MarketList[index][0]] == undefined){
            await GetTickers(MarketList[index][0]);
            if(Use_CheckWithdrawable)                                                //use Withdrawable Checker (Slow speed)
                await GetMarkets(MarketList[index][0]);
        }
    }
}

async function GetTickers(key){
    try{
        const exchange = new ccxt[key]();
        let tickers;

        if(key == 'kraken')
            tickers = await exchange.fetch_tickers(await GetTickersFromKraken(exchange));
        
        else
            tickers = await exchange.fetch_tickers();

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

async function GetTickersFromKraken(exchange){
    let krakenmarket = await exchange.loadMarkets();
    let kraken_tickers = [];
    for(let i in krakenmarket){
        if(i.split('/')[1] == 'USD'){
            kraken_tickers.push(i);
        }
    }
    return kraken_tickers;
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
        if(Symbol_List[key].includes('binance_USDT') && Symbol_List[key].includes('binance_BTC')){
            Symbol_List[key].splice(Symbol_List[key].indexOf('binance_BTC'), 1);
        }
        if(Symbol_List[key].includes('binance_BUSD') && Symbol_List[key].includes('binance_USDT')){
            Symbol_List[key].splice(Symbol_List[key].indexOf('binance_BUSD'), 1);
        }
        if(Symbol_List[key].includes('binance_BUSD') && Symbol_List[key].includes('binance_BTC')){
            Symbol_List[key].splice(Symbol_List[key].indexOf('binance_BTC'), 1);
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

                try{
                    if(tickers[symbol + "/" + market]['close'] == undefined){
                        console.log("Error : failure to fetch | " + exchange + "_" + market + " : " + symbol);
                        continue;
                    }
                }
                catch(e){
                    console.log("Error : failure to fetch | " + exchange + "_" + market + " : " + symbol);
                    continue;
                }

                
                if(CheckExchangeTickerException(exchange, symbol))
                    continue;

                if(tickers[symbol + "/" + market]['close'] == 0)
                    continue;

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
    console.log('Tether Price  : ', tether_price.toFixed(3));
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
                if(CheckExchangePairException(index[j][0], index[i][0]))
                    continue;

                if(index[i][0] == index[j][0])
                    continue;

                let premium = ((index[i][1] / index[j][1]) - 1) * 100;

                if(premium < 0)
                    continue;
                
                if(Math.abs(premium) >= 4){
                    if(Use_CheckWithdrawable){
                        Premium_Sorter.push([
                            premium.toFixed(3), symbol, index[j][0].toUpperCase(), index[i][0].toUpperCase(), index[j][1].toFixed(5), index[i][1].toFixed(5), CheckWithdrawable(index[j][0].split('_')[0], symbol, 'withdraw'), CheckWithdrawable(index[i][0].split('_')[0], symbol, 'deposit')
                        ])
                    }
                    else{
                        Premium_Sorter.push([
                            premium.toFixed(3), symbol, index[j][0].toUpperCase(), index[i][0].toUpperCase(), index[j][1].toFixed(5), index[i][1].toFixed(5)
                        ])
                    }
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
    let output = "";
    for(let i = 0; i < Premium_Sorter.length; i++){
        if(Use_CheckWithdrawable){
            console.log((Premium_Sorter[i][0] + "%").padEnd(10)
            + Premium_Sorter[i][1].padEnd(8)
            + Premium_Sorter[i][2].padEnd(20)
            + Premium_Sorter[i][3].padEnd(20)
            + Premium_Sorter[i][4].padEnd(15)
            + Premium_Sorter[i][5].padEnd(15)
            + Premium_Sorter[i][6].padEnd(10)
            + Premium_Sorter[i][7].padEnd(10));
        }

        else{
            console.log((Premium_Sorter[i][0] + "%").padEnd(10)
            + Premium_Sorter[i][1].padEnd(8)
            + Premium_Sorter[i][2].padEnd(20)
            + Premium_Sorter[i][3].padEnd(20)
            + Premium_Sorter[i][4].padEnd(15)
            + Premium_Sorter[i][5].padEnd(15));
        }
        output += `${Premium_Sorter[i][1]}(${Premium_Sorter[i][0]}%) | ${Premium_Sorter[i][2].split('_')[0]} -> ${Premium_Sorter[i][3].split('_')[0]}\n`;
    }
    
    if(output == "")
        return;

    output += `Tether Price : ${tether_price.toFixed(3)}`;
    if(Use_Telegram)
        bot.sendMessage(process.env.TELEGRAM_CHAT_ID, output);
}

function CheckSymbolException(symbol){
    if(TickerException.includes(symbol))
        return true;
    else
        return false;
}

function CheckExchangePairException(fromexchange, toexchange){
    if(fromexchange == "upbit_BTC")
        return true;

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

async function GetMarkets(key){
    try{
        const exchange = new ccxt[key]();

        if(key == 'binance' || key == 'upbit'){
            exchange.apiKey = process.env[key.toUpperCase() + '_ACCESS_KEY'];
            exchange.secret = process.env[key.toUpperCase() + '_SECRET_KEY'];
        }
        
        const markets = await exchange.fetchCurrencies();
        Market_Data[key] = markets;
    }
    catch(e){
        console.log('Get markets Error:', e);
    }
}

function CheckWithdrawable(exchange, symbol, type){
    symbol = symbol.toUpperCase();
    const nowdata = Market_Data[exchange];

    if(exchange == 'bithumb'){
        return 'x';
    }

    try{
        if(nowdata[symbol][type] == undefined)
            return '-';

        else
            return String(nowdata[symbol][type]);
    }

    catch(e){
        return 'Err';
    }
 
}

async function debuglog(str){
    console.log(str);
}

