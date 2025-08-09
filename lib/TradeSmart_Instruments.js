import { rejects } from "assert";
import axios from "axios";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { DateTime, Zone } from "luxon";

const folderPath = "./instruments";

/**
 * @typedef {Object} Instrument
 * @property {string} Exchange - The exchange name (e.g., NSE, BSE).
 * @property {string} Token - The unique token identifier for the instrument.
 * @property {number} LotSize - The lot size of the instrument.
 * @property {string} Symbol - The symbol representing the instrument.
 * @property {string} TradingSymbol - The trading symbol of the instrument.
 * @property {string} Instrument - The type of instrument (e.g., FUT, OPT).
 * @property {string} Expiry - The expiry date of the instrument in ISO format.
 * @property {string} OptionType - The option type (e.g., CE for Call, PE for Put).
 * @property {string} StrikePrice - The strike price of the option.
 * @property {number} TickSize - The tick size for price increments.
 */

export async function DownloadInstruments() {
  const routes = [
    "https://v2api.tradesmartonline.in/NSE_symbols.txt.zip",
    "https://v2api.tradesmartonline.in/NFO_symbols.txt.zip",
    "https://v2api.tradesmartonline.in/CDS_symbols.txt.zip",
    "https://v2api.tradesmartonline.in/MCX_symbols.txt.zip",
    "https://v2api.tradesmartonline.in/BSE_symbols.txt.zip"
  ];

  // Ensure the output folder exists
  if (!fs.existsSync(folderPath)) {
    try {
      fs.mkdirSync(folderPath, { recursive: true });
    } catch (err) {
      throw new Error("Error creating folder:", err);
    }
  }

  try {
    await Promise.all(
      routes.map(async (url, index, array) => {
        try {
          const resp = await axios({
            method: "get",
            url,
            responseType: "stream"
          });

          const fileName = path.basename(url);
          const outputFileName = fileName.replace(".txt.zip", "");

          const zipFilePath = path.join(folderPath, fileName);
          const writer = fs.createWriteStream(zipFilePath);

          resp.data?.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on("finish", () => resolve());
            writer.on("error", reject);
          });

          const zip = new AdmZip(zipFilePath);
          const zipEntires = zip.getEntries();

          const txtEntry = zipEntires.find(entry => entry.name.endsWith(".txt"));

          if (!txtEntry) {
            throw new Error("No txt File found in the zip archive");
          }

          // Extract the content of the txt file
          const txtContent = zip.readAsText(txtEntry);

          // Convert CSV to JSON
          const rows = txtContent
            .trim()
            .split("\n")
            .map(line => line.trim().split(","));

          const header = rows[0];
          const jsonData = rows.slice(1).map(row => {
            let obj = {};
            header.forEach((key, index) => {
              if (key && key.trim()) {
                obj[key] = row[index] || "";
              }
            });
            return obj;
          });

          const jsonFilePath = path.join(folderPath, `${outputFileName}.json`);
          fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData));

          fs.unlinkSync(zipFilePath);
        } catch (error) {
          throw error;
        }
      })
    );
  } catch (error) {
    throw error;
  }
}

export function getFileData(exchange) {
  try {
    let filename = `${exchange}_symbols.json`;
    const filepath = path.join(folderPath, filename);
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (error) {
    throw error;
  }
}

function isFileOldOrNotExists(filePath) {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const stats = fs.statSync(filePath);
    const modifiedTime = stats.mtime;
    const filetime = DateTime.fromJSDate(modifiedTime);
    const targetTime = DateTime.local().set({ hour: 8, minute: 30, second: 0, millisecond: 0 });
    return filetime < targetTime || stats.size === 0;
  } catch (error) {
    return true;
  }
}

export async function CheckInstruments() {
  try {
    const filePath = "./instruments/NSE_symbols.json";
    const shouldDownloadFile = isFileOldOrNotExists(filePath);
    if (shouldDownloadFile) {
      await DownloadInstruments();
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Finds an instrument based on the provided parameters.
 *
 * @param {Object} params - The parameters to find the instrument.
 * @param {String} params.Exchange - The exchange type (e.g., NSE, BSE).
 * @param {string} params.Symbol - The symbol representing the instrument.
 * @param {string} params.Instrument - The type of instrument (e.g., FUT, OPT).
 * @param {string} [params.Expiry] - The expiry date of the instrument in ISO format (optional).
 * @param {string} [params.OptionType] - The option type (e.g., CE for Call, PE for Put) (optional).
 * @param {string} [params.StrikePrice] - The strike price of the option (optional).
 * @param {string} [fd] - File data if passsed for faster search.
 * @returns {Instrument|Instrument[] | null} - The matching instrument or null if not found.
 */
export function FindInstruments(params, fd) {
  if (!params.Exchange || !params.Symbol) {
    throw new Error("Exchange not found or Symbol is missing");
  }

  const filedata = fd || getFileData(params.Exchange);

  /**
   * @type {Instrument[]|null}
   */
  const instrumentdata = filedata
    .filter(scrip => {
      return Object.keys(params).every(key => {
        if (params[key] === "" || params[key] === undefined) {
          return true;
        }
        return scrip[key] === params[key];
      });
    })
    .sort((a, b) => new Date(a?.Expiry).getTime() - new Date(b?.Expiry).getTime());

  if (!instrumentdata.length) {
    return null;
  }

  if (instrumentdata.length === 1) {
    return instrumentdata[0];
  }

  return instrumentdata;
}

/**
 * Retrieves a list of sorted unique expiry dates for the specified parameters.
 *
 * @param {Object} params - The parameters to filter instruments.
 * @param {String} params.Exchange - The exchange type (e.g., NSE, BSE).
 * @param {string} params.Symbol - The symbol representing the instrument.
 * @param {string} params.Instrument - The type of instrument (e.g., FUT, OPT).
 * @param {Instrument[]} [fd] - An optional array of Instrument objects to filter. If not provided, it fetches data from `getFileData`.
 * @returns {string[]} - A sorted array of unique expiry dates.
 */
export function GetExpiryDates(params, fd) {
  const filedata = fd || getFileData(params.Exchange);

  const filteredData = filedata.filter(scrip => {
    return Object.keys(params).every(paramKey => {
      return params[paramKey] === scrip[paramKey];
    });
  });

  const uniqueDates = new Set(filteredData.map(s => s.Expiry));
  const sortedDates = Array.from(uniqueDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return sortedDates;
}

/**
 * @typedef {Object} OptionStrikes
 * @property {string} atm - The ATM strike price.
 * @property {string[]} upstrikes - An array of OTM strikes (above ATM).
 * @property {string[]} dnstrikes - An array of ITM strikes (below ATM).
 */

/**
 * Calculates the ATM (At The Money) strike and nearby ITM/OTM strikes based on the given parameters.
 *
 * @param {Object} params - The parameters to find option strikes.
 * @param {String} params.Exchange - The exchange type (e.g., NSE, BSE).
 * @param {string} params.Symbol - The symbol of the instrument.
 * @param {string} params.Instrument - The type of instrument (e.g., FUT, OPT).
 * @param {string} params.Expiry - The expiry date of the option.
 * @param {number} params.Price - The underlying price to find the ATM strike.
 * @param {number} params.MaxStrikes - The maximum number of strikes to include in ITM/OTM lists.
 * @param {Instrument[]} [fd] - An optional array of ShoonyaInstrument objects. If not provided, data is fetched using `getFileData`.
 * @returns {OptionStrikes|null} - An object containing the ATM strike and nearby strikes, or `null` if an error occurs.
 */
export function GetOptionStrike(params, fd) {
  try {
    const { Exchange, Symbol, Instrument, Expiry, Price, MaxStrikes } = params;

    if (!Exchange || !Symbol || !Instrument || !Expiry || !Price || !MaxStrikes) {
      throw new Error("Invalid or missing parameters.");
    }

    const fileData = fd || getFileData(params.Exchange); // Load data if not provided

    // Filter instruments based on parameters
    const filteredInstruments = fileData.filter(
      inst =>
        inst.Exchange === Exchange && inst.Symbol === Symbol && inst.Instrument === Instrument && inst.Expiry === Expiry
    );

    // Extract and sort strikes
    const sortedStrikes = Array.from(new Set(filteredInstruments.map(inst => parseFloat(inst.StrikePrice))))
      .map(strike => ({
        strike,
        diff: Math.abs(strike - Price)
      }))
      .sort((a, b) => a.diff - b.diff);

    if (sortedStrikes.length === 0) {
      return { atm: null, upstrikes: [], dnstrikes: [] };
    }

    // Calculate ATM
    const atm = sortedStrikes[0].strike;

    // Get ITM and OTM strikes
    const dnstrikes = sortedStrikes
      .filter(s => s.strike < atm)
      .slice(0, MaxStrikes)
      .map(s => s.strike);

    const upstrikes = sortedStrikes
      .filter(s => s.strike > atm)
      .slice(0, MaxStrikes)
      .map(s => s.strike);

    return { atm, upstrikes, dnstrikes };
  } catch (error) {
    console.error("Error in GetOptionStrike:", error.message);
    return null;
  }
}
