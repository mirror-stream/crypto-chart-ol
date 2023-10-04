import config from "config";
import cron from "node-cron";

import db from "../helpers/mongodb.js";
import { KrakenConfig } from "../types/config.js";
import KrakenOhlcv from "./lib/kraken/ohlcv.js";

const processData = async () => {
  try {
    console.log("update batch started");
    const krakenConfig: KrakenConfig = config.get("kraken");
    const quoteAssets = krakenConfig.quoteAssets;
    const baseAsset = krakenConfig.baseAsset;
    const dailyDataNum = krakenConfig.dailyDataNum;

    await Promise.all(
      quoteAssets.map(async (quoteAsset: { symbol: string; altname: string }) => {
        // dailyDataNum + 1 because I need to get the previous day's data as well
        const ohlcv = new KrakenOhlcv(quoteAsset.symbol, baseAsset.symbol, dailyDataNum + 1);
        const data = await ohlcv.get();
        // Reverse the data so that the most recent data is first
        const reversedData = data.reverse();
        const existingData = await ohlcv.findDataByCloseTime(reversedData[0].targetTime);
        if (existingData) {
          await ohlcv.updateDataByCloseTime(reversedData[0].targetTime, reversedData[0]);
        } else {
          ohlcv.insert(reversedData[0]);
          await ohlcv.updatePreviousData(reversedData[1]);
        }
      })
    );
  } finally {
    console.log("update batch completed");
  }
};

console.log("update batch running");

db.connect();
// Run every 6 hours
cron.schedule("0 */6 * * *", () => {
  processData();
});