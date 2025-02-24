"strict";

import axios from "axios";
import { createHash } from "crypto";
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

      console.log("data", data);

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
          throw new Error(`Server Error : ${response.data?.emsg}`);
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

      console.log("request data", request_data);

      const resp = await this.#apiClient.post(this.#routes.login, request_data);
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

  async getPositionBook() {
    try {
      let req_data = { uid: this.#uid, actid: this.#actid };
      const resp = await this.#apiClient.post(this.#routes.positions, req_data);
      return resp.data;
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
      return resp.data;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async getTradeBook() {
    try {
      let req_data = { uid: this.#uid, actid: this.#actid };
      const resp = await this.#apiClient.post(this.#routes.tradebook, req_data);
      return resp.data;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Place Order
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
   *
   */
  async placeorder(params) {
    try {
      if (!params.exch || !params.tsym || !params.prd || !params.tsym || !params.trantype || !params.qty || !params.prctyp) {
        throw new Error("exch, tsym, prd, tsym, trantype, qty, prctyp required");
      }
      let req_data = { uid: this.#uid, actid: this.#actid, exch: params.exch, tsym: params.tsym, qty: params.qty, prc: params.prc || 0, dscqty: 0, prd: params.prd, trantype: params.trantype, prctyp: params.prctyp, ret: params.ret || "DAY", remarks: "none", ordersource: "API" };

      const resp = await this.#apiClient.post(this.#routes.placeorder, req_data);
      return resp.data;
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
