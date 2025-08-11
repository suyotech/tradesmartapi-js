import { WebSocket } from "ws";
import { TradeSmartAPI } from "./TradeSmart_API.js";

export class TradeSmartWS {
  /**
   * @type {WebSocket}
   */
  #socket = null;
  #reconnectInterval = 10000;
  #reconnectAttempts = 200;
  #currentReconnectAttempts = 0;
  #heartBeatInterval = null;
  #heartBeatDuration = 3000;
  #debug = false;
  #uid = "";
  #actid = "";
  #susertoken = "";
  #socketConnecting = false;
  #disconnectedManually = false;
  #webSocketURL = "wss://v2api.tradesmartonline.in/NorenWSTP/";
  #onDataCallback;
  #onOrderCallback;

  /**
   * @param {string} name
   * @param {TradeSmartAPI} api
   */
  constructor(name = "socket", api) {
    if (!name || !api) {
      throw new Error("websocket required name and api");
    }
    this.#uid = api.uid;
    this.#actid = api.actid;
    this.#susertoken = api.susertoken;
  }

  async connect() {
    if (this.#socketConnecting) return;
    this.#socketConnecting = true;
    this.#disconnectedManually = false;

    return new Promise((resolve, reject) => {
      try {
        this.#socket = new WebSocket(this.#webSocketURL, { rejectUnauthorized: false });

        this.#socket.onopen = () => {
          this.#currentReconnectAttempts = 0; // Reset reconnect attempts on successful connection
          this.#setHeartBeat();

          const connectData = {
            t: "c",
            uid: this.#uid,
            actid: this.#actid,
            susertoken: this.#susertoken
          };

          this.#socket.send(JSON.stringify(connectData));
          console.log("websocket connected");

          resolve();
        };

        this.#socket.onerror = e => {
          console.error("WebSocket Error:", e);
          reject(e);
        };

        this.#socket.onclose = e => {
          this.#clearHeartBeat();
          console.log("WebSocket Closed");
          if (this.#debug) {
            console.log(e);
          }

          if (!this.#disconnectedManually) {
            this.#attemptReconnect();
          }
        };

        this.#socket.onmessage = e => {
          // @ts-ignore
          const data = JSON.parse(e?.data);

          if (["tk", "tf", "df", "dk"].includes(data.t) && this.#onDataCallback !== null) {
            this.#onDataCallback(data);
          } else if (["om"].includes(data.t) && this.#onOrderCallback) {
            this.#onOrderCallback(data);
          } else if (this.#debug) {
            console.log("Message Recived", data);
          }
        };
      } catch (error) {
        reject(error);
      }
    }).finally(() => {
      this.#socketConnecting = false;
    });
  }

  #attemptReconnect() {
    if (this.#currentReconnectAttempts < this.#reconnectAttempts) {
      this.#currentReconnectAttempts++;
      console.log(`Reconnect attempt ${this.#currentReconnectAttempts}...`);

      setTimeout(() => {
        this.connect().catch(err => {
          console.error("Reconnect failed:", err);
        });
      }, this.#reconnectInterval);
    } else {
      console.error("Max reconnect attempts reached. Unable to reconnect.");
    }
  }

  #setHeartBeat() {
    this.#heartBeatInterval = setInterval(() => {
      if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
        this.#socket.send(JSON.stringify({ t: "h" }));
      }
    }, this.#heartBeatDuration);
  }

  #clearHeartBeat() {
    if (this.#heartBeatInterval) {
      clearInterval(this.#heartBeatInterval);
      this.#heartBeatInterval = null;
    }
  }

  /**
   *
   * @param {Function} callback
   */
  onData(callback) {
    this.#onDataCallback = callback;
  }

  /**
   *
   * @param {Function} callback
   */
  onOrder(callback) {
    this.#onOrderCallback = callback;
  }

  disconnect() {
    if (this.#socket) {
      this.#disconnectedManually = true;
      this.#clearHeartBeat();
      this.#socket.close();
      this.#socket = null;
    }
  }

  /**
   *
   * @param {import("./TradeSmart_Instruments").Instrument[]} instruments
   */
  async subscribe(instruments = []) {
    if (!this.#socket || this.#socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected.");
    }

    if (!instruments || !instruments.length) {
      throw new Error("instruments invalid");
    }

    const subString = instruments
      .map(i => {
        return `${i.Exchange}|${i.Token}`;
      })
      .join("#");

    // console.log("subString", subString);

    const subscribeData = { t: "t", k: subString };
    this.#socket.send(JSON.stringify(subscribeData));
  }
}
