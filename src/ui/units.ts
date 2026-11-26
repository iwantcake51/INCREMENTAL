// Temperatures are written in °C in the data (as NASA publishes them) and shown in °F.
const NUM = String.raw`[−-]?\d[\d,]*(?:\.\d+)?`;
const toNum = (s: string) => parseFloat(s.replace(/,/g, "").replace("−", "-"));
const fmt = (f: number) => {
  const r = Math.abs(f) >= 1000 ? Math.round(f / 10) * 10 : Math.round(f);
  return (r < 0 ? "−" : "") + Math.abs(r).toLocaleString("en-US");
};
const cToF = (c: number) => (c * 9) / 5 + 32;

/** Rewrite every Celsius temperature in a piece of text as Fahrenheit. */
export function toF(text: string): string {
  return text
    // "−173 to 427 °C"
    .replace(new RegExp(`(${NUM})(\\s*(?:to|–|-)\\s*)(${NUM})\\s*°C`, "g"), (_, a, sep, b) => `${fmt(cToF(toNum(a)))}${sep}${fmt(cToF(toNum(b)))} °F`)
    // "~15 million °C"
    .replace(new RegExp(`(${NUM})\\s*million\\s*°C`, "g"), (_, a) => `${fmt(toNum(a) * 1.8)} million °F`)
    // "464 °C"
    .replace(new RegExp(`(${NUM})\\s*°C`, "g"), (_, a) => `${fmt(cToF(toNum(a)))} °F`);
}
