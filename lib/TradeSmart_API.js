"strict";

import axios from "axios";
import { createHash } from "crypto";
import { DateTime } from "luxon";
import { TOTP } from "totp-generator";

export class TradeSmartAPI {
  #baseURL = "https://v2api.tradesmartonline.in//NorenWClientTP";
  #susertoken = "";
  #uid = "";
  #actid = "";
  #pwd = "";
  #vc = "";
  #apikey = "";
  #totpkey = "";
  #debug = false;

  /**
   * @type {import("axios").AxiosInstance}
   */

  #apiClient;

  /**
   * Creates new instance of Tradesmart API Client
   * @param {String} uid User ID
   * @param {String} pwd Password
   * @param {String} vc Vendor Code
   * @param {String} apikey API Key
   * @param {String} totpkey TOTP Key
   *
   */
  constructor(uid, pwd, vc, apikey, totpkey) {
    this.#uid = uid;
    this.#actid = uid;
    this.#pwd = pwd;
    this.#vc = vc;
    this.#apikey = apikey;
    this.#totpkey = totpkey;

    this.#apiClient = this.#createAxiosInstance();
  }

  #routes = {
    login: "/QuickAuth",
    limits: "/Limits",
    positions: "/PositionBook",
    placeorder: "/PlaceOrder",
    modifyorder: "/ModifyOrder",
    cancelorder: "/CancelOrder",
    exitorder: "/ExitSNOOrder",
    orderbook: "/OrderBook",
    tradebook: "/TradeBook",
    holdings: "/Holdings",
    tpseries: "/TPSeries",
  };

  /**
   * Creates Axios Instance for api client
   * @returns {import("axios").AxiosInstance}
   */
  #createAxiosInstance() {
    const axiosInstance = axios.create({
      baseURL: this.#baseURL,
      timeout: 7000,
    });

    axiosInstance.interceptors.request.use((config) => {
      const objtostr = (obj = {}) => {
        let newobj = {};
        Object.keys(obj).forEach((key) => {
          newobj[key] = String(obj[key]);
        });

        return newobj;
      };

      let data = `jData=${JSON.stringify(objtostr(config.data))}`;
      if (this.#susertoken) {
        data = data + `&jKey=${this.#susertoken}`;
      }
      config.data = data;

      if (this.#debug) {
        console.log(config);
      }
      return config;
    });

    axiosInstance.interceptors.response.use(
      (response) => {
        if (this.#debug) {
          console.log(response);
        }
        if (response.data?.stat !== "Ok" && !Array.isArray(response.data)) {
          if (response.data?.emsg && response.data?.emsg.includes("no data")) {
            return null;
          } else {
            throw new Error(`Server Error : ${response.data?.emsg}`);
          }
        }

        return response;
      },
      (error) => {
        if (this.#debug) {
          console.log("error", error);
        }
        if (error.response) {
          throw new Error(`Response Error ${error.response.data?.emsg}`);
        } else if (error.request) {
          throw new Error(`Request Error ${error.status} ${error.statusText}`);
        } else {
          throw new Error(`General Error :  ${error.message}`);
        }
      }
    );

    return axiosInstance;
  }

  #createHash(value = "") {
    return createHash("sha256").update(value).digest("hex");
  }

  /**
   * Generates Session for user
   *
   */
  async login() {
    try {
      const request_data = {
        source: "API",
        apkversion: "js:1.0.0",
        uid: this.#uid,
        pwd: this.#createHash(this.#pwd),
        factor2: TOTP.generate(this.#totpkey).otp,
        vc: this.#vc,
        appkey: this.#createHash(`${this.#uid}|${this.#apikey}`),
        imei: "123484",
      };

      const resp = await this.#apiClient.post(this.#routes.login, request_data);
      this.#susertoken = resp.data?.susertoken;
      return resp.data;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Set Debug to view details
   * @param {Boolean} value
   */
  setDebug(value) {
    this.#debug = value;
  }

  setSessionDetails(uid = "", susertoken = "") {
    this.uid = uid;
    this.#susertoken = susertoken;
    this.#actid = uid;
  }

  getSessionDetails() {
    const details = {
      uid: this.#uid,
      susertoken: this.#susertoken,
      actid: this.#actid,
    };
    return details;
  }

  async getPositionBook() {
    try {
      let req_data = { uid: this.#uid, actid: this.#actid };
      const resp = await this.#apiClient.post(this.#routes.positions, req_data);
      return resp?.data || null;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getLimits() {
    try {
      let req_data = { uid: this.#uid, actid: this.#actid };
      const resp = await this.#apiClient.post(this.#routes.limits, req_data);
      return resp.data;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getOrderBook() {
    try {
      let req_data = { uid: this.#uid };
      const resp = await this.#apiClient.post(this.#routes.orderbook, req_data);
      return resp?.data || null;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getTradeBook() {
    try {
      let req_data = { uid: this.#uid, actid: this.#actid };
      const resp = await this.#apiClient.post(this.#routes.tradebook, req_data);
      return resp?.data || null;
    } catch (error) {
      if (this.#debug) {
        console.error(error);
      }
      throw new Error(error.message);
    }
  }

  /**
   * Place Order
   * @async
   * @function placeorder
   * @param {Object} params
   * @property {String} exch Exchange NSE / NFO / CDS / MCX / BSE / BFO
   * @property {String} tsym Trading Symbol RELIANCE-EQ / L&TFH29SEP22P97 / USDINR25NOV22C76 / CRUDEOIL16NOV22P5400 / WHIRLPOOL
   * @property {Number} qty Trade Quantiry
   * @property {Number} prc Price 0
   * @property {Number} [trgprc] Trigger Price - Only to be sent in case of SL / SL-M order.
   * @property {String} prd  Product Type "C" For CNC, "M" FOR NRML, "I" FOR MIS, "B" FOR BRACKET ORDER, "H" FOR COVER ORDER
   * @property {String} trantype 	Transaction Type B -> BUY, S -> SELL
   * @property {String} prctyp  Price Type LMT / MKT / SL-LMT / SL-MK
   * @property {String} ret Order Retention DAY / EOS / IOC
   * @returns {String} Returns orderid of placed order
   * @throws {Error} Throws if required parameters are missing or the API call fails.
   */
  async placeorder(params) {
    try {
      if (
        !params.exch ||
        !params.tsym ||
        !params.prd ||
        !params.tsym ||
        !params.trantype ||
        !params.qty ||
        !params.prctyp
      ) {
        throw new Error(
          "exch, tsym, prd, tsym, trantype, qty, prctyp required"
        );
      }
      let req_data = {
        uid: this.#uid,
        actid: this.#actid,
        exch: params.exch,
        tsym: params.tsym,
        qty: params.qty,
        prc: params.prc || 0,
        dscqty: 0,
        prd: params.prd,
        trantype: params.trantype,
        prctyp: params.prctyp,
        ret: params.ret || "DAY",
        remarks: "none",
        ordersource: "API",
      };

      const resp = await this.#apiClient.post(
        this.#routes.placeorder,
        req_data
      );
      return resp.data;
    } catch (error) {
      if (this.#debug) {
        console.error(error);
      }
      throw new Error(error.message);
    }
  }

  /**
   * Fetches historical candle data for a given instrument.
   *
   * @async
   * @function getCandleData
   * @param {Object} params - Parameters for fetching candle data.
   * @param {string} params.exchange - Exchange code (e.g., "NSE", "NFO", "BSE", "CDS"). **Required**
   * @param {string} params.token - Token number of the contract. **Required**
   * @param {string} params.starttime - Start time in format "yyyy-MM-dd HH:mm:ss" (UTC). **Required**
   * @param {string} params.endtime - End time in format "yyyy-MM-dd HH:mm:ss" (UTC). **Required**
   * @param {string} [params.interval="1"] - Candle size in minutes. Defaults to "1" if not provided.
   * @returns {Promise<Array>} A promise resolving to the candle data response.
   * @throws {Error} Throws if required parameters are missing or the API call fails.
   *
   * @example
   * const data = await getCandleData({
   *   exchange: "NSE",
   *   token: "12345",
   *   starttime: "2025-08-12 09:15:00",
   *   endtime: "2025-08-12 09:30:00",
   *   interval: "5"
   * });
   * console.log(data);
   */
  async getCandleData(params) {
    try {
      const { exchange, token, starttime, endtime, interval } = params || {};

      if (!exchange || !token || !starttime || !endtime || !interval) {
        throw new Error(
          "exchange, token, starttime, endtime, and interval are required"
        );
      }

      const convertTime = (timestr) =>
        DateTime.fromFormat(timestr, "yyyy-MM-dd HH:mm:ss", {
          zone: "utc",
        })
          .toSeconds()
          .toString();

      const reqData = {
        uid: this.#uid,
        exch: exchange,
        token,
        st: convertTime(starttime),
        et: convertTime(endtime),
        intrv: String(interval),
      };

      console.log({ reqData });

      const resp = await this.#apiClient.post(this.#routes.tpseries, reqData);
      const cd = resp?.data;
      return cd.map((c) => {
        return {
          time: c.time, // "19-08-2025 15:10:00"
          open: parseFloat(c.into), // Open price
          high: parseFloat(c.inth), // High price
          low: parseFloat(c.intl), // Low price
          close: parseFloat(c.intc), // Close price
          volume: Number(c.intv), // Current candle volume
          tvolume: Number(c.v), // Total volume (if that's what `v` means)
          oi: Number(c.oi), // Open Interest
          coi: Number(c.intoi), // Change in OI
          vwap: parseFloat(c.intvwap), // VWAP
        };
      });
    } catch (error) {
      if (this.#debug) {
        console.error(error);
      }
      throw new Error(`Failed to fetch candle data: ${error.message}`);
    }
  }
}
