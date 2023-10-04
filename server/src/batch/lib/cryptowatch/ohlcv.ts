import axios from "axios";
import config from "config";
import { Model } from "mongoose";

import { CryptowatchConfig } from "../../../types/config.js";
import Ohlcv, { OhlcvDocument } from "../../../models/ohlcv.js";

class CryptowatchOhlcv {
  private cryptowatchConfig: CryptowatchConfig;
  private period: number;
  private quoteAsset: string;
  private baseAsset: string;
  private pair: string;
  private dataLimit: number;
  private url: string;
  private ohlcvModel: Model<OhlcvDocument>;

  constructor(quoteAsset: string, baseAsset: string, dataLimit: number) {
    this.cryptowatchConfig = config.get("cryptowatch");
    this.period = this.cryptowatchConfig.period.daily;
    this.quoteAsset = quoteAsset;
    this.baseAsset = baseAsset;
    this.pair = `${this.quoteAsset}${this.baseAsset}`;
    this.dataLimit = dataLimit;
    this.url = `${this.cryptowatchConfig.apiUrl}/0/public/OHLC?pair=${this.pair}`;
    console.log(this.url);
    this.ohlcvModel = Ohlcv(`kraken_ohlcv_${this.quoteAsset}_${this.baseAsset}`);
  }

  async get(): Promise<OhlcvDocument[]> {
    return axios
      .get(this.url, {
        params: {
          interval: this.period,
        },
      })
      .then((response) => {
        const data = response.data.result[this.pair].slice(-this.dataLimit);
        console.log(data);
        const formattedData = data.map((d: number[]) => {
          return {
            // Cryptowatch API returns time in seconds, but we want milliseconds
            closeTime: d[0] * 1000,
            // 1 day ago
            targetTime: (d[0] - 24 * 60 * 60) * 1000,
            open: d[1],
            high: d[2],
            low: d[3],
            close: d[4],
            volume: d[6],
          };
        });
        return formattedData;
      })
      .catch((error) => {
        console.log(error);
      });
  }
  async insert(data: OhlcvDocument | OhlcvDocument[]): Promise<void> {
    try {
      await this.ohlcvModel.insertMany(data);
    } catch (error) {
      console.log(error);
      console.log("Error inserting data");
    }
  }

  async updatePreviousData(data: OhlcvDocument): Promise<void> {
    const previousData = await this.ohlcvModel.findOne({ closeTime: data.closeTime });
    if (previousData) {
      await this.ohlcvModel.findOneAndUpdate({ closeTime: previousData.closeTime }, { $set: data }, { new: true });
    }
  }

  async findDataByCloseTime(closeTime: number): Promise<OhlcvDocument | null> {
    return this.ohlcvModel.findOne({ closeTime });
  }

  async updateDataByCloseTime(closeTime: number, newData: OhlcvDocument): Promise<OhlcvDocument | null> {
    return this.ohlcvModel.findOneAndUpdate({ closeTime }, { $set: newData }, { new: true });
  }
}

export default CryptowatchOhlcv;
