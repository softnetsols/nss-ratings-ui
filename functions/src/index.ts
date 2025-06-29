import {pubsub} from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

const tickers = [
  "AAPL", "MSFT", "GOOG", "TSLA", "AMZN", "META", "NVDA", "NFLX", "AMD",
  "INTC", "DIS", "BABA", "PYPL", "CSCO", "ADBE", "ORCL", "CRM", "QCOM",
];

let yahooFinance: any;
(async () => {
  yahooFinance = await import("yahoo-finance2").then((mod) => mod.default);
})();
export const dailyStockScanner = pubsub.schedule("0 13 * * 1-5")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    const results: any[] = [];

    for (const symbol of tickers) {
      try {
        const quote = await yahooFinance.quote(symbol);
        const price = quote.regularMarketPrice;
        const volume = quote.regularMarketVolume;
        const marketCap = quote.marketCap;

        if (price > 1 && volume > 1_000_000 && marketCap > 1_000_000_000) {
          const percentChange = quote.regularMarketChangePercent;
          results.push({
            symbol,
            price,
            volume,
            marketCap,
            percentChange,
          });
        }
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
      }
    }

    results.sort((a, b) => b.percentChange - a.percentChange);
    const top10 = results.slice(0, 10);

    await db.collection("dailyWatchlist").doc("today").set({
      date: admin.firestore.FieldValue.serverTimestamp(),
      stocks: top10,
    });

    console.log("Saved daily watchlist:", top10);
    return null;
  });
