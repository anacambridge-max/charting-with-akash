export type PrimeCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PrimeSignal = {
  state: "NO TRADE" | "WATCH" | "SETUP" | "CONFIRMED" | "FAKE BREAKOUT";
  direction: "NEUTRAL" | "BUY" | "SELL" | "FAKE BULL" | "FAKE BEAR" | "BULLISH" | "BEARISH";
  triggerName: "—" | "YH / PDH" | "YL / PDL";
  triggerLevel: number | null;
  score: number | null;
  grade: string;
  confirmation: boolean;
  fastConfirmation: boolean;
  qualityConfirmation: boolean;
  fakeBreakout: boolean;
  volumeMultiple: number;
  ema20: number | null;
  structuralSL: number | null;
  riskPerShare: number | null;
  riskQuantity: number | null;
  reason: string;
};

const sma = (values: number[], period: number) => {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
};

const ema = (values: number[], period: number) => {
  if (values.length < period) return null;
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) value = values[i] * k + value * (1 - k);
  return value;
};

const dayKey = (t: number) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date(t * 1000));

const minutesIST = (t: number) => {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(new Date(t * 1000));
  return Number(p.find(x => x.type === "hour")?.value || 0) * 60 + Number(p.find(x => x.type === "minute")?.value || 0);
};

function previousDayLevels(candles: PrimeCandle[], index: number) {
  const current = dayKey(candles[index].time);
  const days = Array.from(new Set(candles.slice(0, index + 1).map(c => dayKey(c.time)))).sort();
  const pos = days.indexOf(current);
  if (pos <= 0) return null;
  const prev = days[pos - 1];
  const day = candles.slice(0, index + 1).filter(c => dayKey(c.time) === prev);
  if (!day.length) return null;
  const high = Math.max(...day.map(c => c.high));
  const low = Math.min(...day.map(c => c.low));
  return { high, low, mid: (high + low) / 2 };
}

function grade(score: number | null) {
  if (score === null) return "—";
  if (score >= 90) return "PRIME A+";
  if (score >= 80) return "PRIME A";
  if (score >= 70) return "STRONG";
  if (score >= 60) return "GOOD";
  if (score >= 50) return "WATCH";
  return "WEAK";
}

export function evaluatePrimeAt(candles: PrimeCandle[], index: number, mode: "FAST PRIME" | "QUALITY PRIME" = "QUALITY PRIME"): PrimeSignal {
  const c = candles[index];
  const prev = candles[index - 1];
  const levels = previousDayLevels(candles, index);
  if (!levels || !prev) return empty();

  const ranges = candles.slice(Math.max(0, index - 10), index).map(x => x.high - x.low).filter(x => x > 0);
  const volumes = candles.slice(Math.max(0, index - 20), index).map(x => x.volume).filter(x => Number.isFinite(x));
  const avgRange = sma(ranges, Math.min(10, ranges.length));
  const avgVolume = sma(volumes, Math.min(20, volumes.length));
  const range = Math.max(0, c.high - c.low);
  const body = Math.abs(c.close - c.open);
  const bodyRatio = range > 0 ? body / range : 0;
  const bullLoc = range > 0 ? (c.close - c.low) / range : 0;
  const bearLoc = range > 0 ? (c.high - c.close) / range : 0;
  const volumeMultiple = avgVolume && avgVolume > 0 ? c.volume / avgVolume : 0;
  const ema20 = ema(candles.slice(0, index + 1).map(x => x.close), 20);
  const rangeExpansion = avgRange && avgRange > 0 ? range / avgRange : 0;

  const mins = minutesIST(c.time);
  const inWindow = mins >= 555 && mins <= 600;
  const bullBreak = inWindow && c.close > levels.high && prev.close <= levels.high;
  const bearBreak = inWindow && c.close < levels.low && prev.close >= levels.low;
  const bullEMAOK = ema20 === null || c.close > ema20;
  const bearEMAOK = ema20 === null || c.close < ema20;
  const bullReaction = c.close > c.open && bodyRatio >= 0.5 && bullLoc >= 0.6;
  const bearReaction = c.close < c.open && bodyRatio >= 0.5 && bearLoc >= 0.6;
  const volumePass = volumeMultiple >= 1.5;
  const rangeExpanded = rangeExpansion >= 1.3;
  const bullFast = bullBreak && volumePass && bullEMAOK;
  const bearFast = bearBreak && volumePass && bearEMAOK;
  const bullQuality = bullFast && bullReaction && rangeExpanded;
  const bearQuality = bearFast && bearReaction && rangeExpanded;
  const bullConfirmation = mode === "FAST PRIME" ? bullFast : bullQuality;
  const bearConfirmation = mode === "FAST PRIME" ? bearFast : bearQuality;

  const distanceYH = Math.abs(c.close - levels.high) / levels.high * 100;
  const distanceYL = Math.abs(c.close - levels.low) / levels.low * 100;
  const bullSetup = inWindow && distanceYH <= 1 && c.close >= levels.high;
  const bearSetup = inWindow && distanceYL <= 1 && c.close <= levels.low;

  const recent = candles.slice(Math.max(0, index - 3), index);
  const fakeBull = inWindow && recent.some(x => x.high > levels.high) && c.high > levels.high && c.close < levels.high;
  const fakeBear = inWindow && recent.some(x => x.low < levels.low) && c.low < levels.low && c.close > levels.low;

  let score: number | null = null;
  if (bullConfirmation || bearConfirmation) {
    const bull = bullConfirmation;
    const penetration = bull ? ((c.close - levels.high) / levels.high) * 100 : ((levels.low - c.close) / levels.low) * 100;
    const penetrationScore = Math.max(0, Math.min(15, penetration / 1 * 15));
    const volumeScore = volumeMultiple >= 6.5 ? 20 : volumeMultiple >= 4 ? 18 : volumeMultiple >= 2 ? 15 : volumeMultiple >= 1.5 ? 10 : volumeMultiple >= 1.2 ? 5 : 0;
    const bodyScore = Math.min(15, bodyRatio * 15);
    const closeScore = (bull ? bullLoc : bearLoc) * 10;
    const emaSeparation = ema20 ? Math.abs(c.close - ema20) / ema20 * 100 : 0;
    const emaScore = Math.min(15, Math.max(0, emaSeparation / 1 * 15));
    const rangeScore = rangeExpansion >= 2 ? 10 : rangeExpansion >= 1.75 ? 9 : rangeExpansion >= 1.5 ? 8 : rangeExpansion >= 1.3 ? 6 : rangeExpansion >= 1.1 ? 3 : 0;
    const fromOpen = mins - 555;
    const timingScore = fromOpen <= 5 ? 10 : fromOpen <= 10 ? 9 : fromOpen <= 15 ? 8 : fromOpen <= 20 ? 6 : fromOpen <= 30 ? 4 : fromOpen <= 45 ? 2 : 0;
    const compressionScore = rangeExpanded ? 2 : 0;
    score = Math.min(100, Math.max(0, volumeScore + penetrationScore + bodyScore + closeScore + emaScore + rangeScore + timingScore + compressionScore));
  }

  const confirmation = bullConfirmation || bearConfirmation;
  const direction = bullConfirmation ? "BUY" : bearConfirmation ? "SELL" : fakeBull ? "FAKE BULL" : fakeBear ? "FAKE BEAR" : bullSetup ? "BULLISH" : bearSetup ? "BEARISH" : "NEUTRAL";
  const state = fakeBull || fakeBear ? "FAKE BREAKOUT" : confirmation ? "CONFIRMED" : bullSetup || bearSetup ? "SETUP" : distanceYH <= 1 || distanceYL <= 1 ? "WATCH" : "NO TRADE";
  const triggerLevel = bullConfirmation || bullSetup ? levels.high : bearConfirmation || bearSetup ? levels.low : null;
  const structuralSL = bullConfirmation ? c.low : bearConfirmation ? c.high : null;
  const riskPerShare = structuralSL !== null ? Math.abs(c.close - structuralSL) : null;
  const riskQuantity = riskPerShare && riskPerShare > 0 ? Math.floor(500000 * 0.005 / riskPerShare) : null;
  const reason = confirmation
    ? `${bullConfirmation ? "PDH breakout" : "PDL breakdown"} + ${volumeMultiple.toFixed(1)}X volume + EMA20 ${bullConfirmation ? "above" : "below"}${mode === "QUALITY PRIME" ? " + quality candle + range expansion" : ""}`
    : fakeBull || fakeBear ? "Level wick break failed to close beyond YH/YL" : state === "SETUP" ? "Price at previous-day level; waiting for confirmation" : "No PRIME condition";

  return {
    state, direction,
    triggerName: triggerLevel !== null ? (bullConfirmation || bullSetup ? "YH / PDH" : "YL / PDL") : "—",
    triggerLevel, score, grade: grade(score), confirmation,
    fastConfirmation: bullFast || bearFast,
    qualityConfirmation: bullQuality || bearQuality,
    fakeBreakout: fakeBull || fakeBear,
    volumeMultiple, ema20, structuralSL, riskPerShare, riskQuantity, reason,
  };
}

function empty(): PrimeSignal {
  return { state: "NO TRADE", direction: "NEUTRAL", triggerName: "—", triggerLevel: null, score: null, grade: "—", confirmation: false, fastConfirmation: false, qualityConfirmation: false, fakeBreakout: false, volumeMultiple: 0, ema20: null, structuralSL: null, riskPerShare: null, riskQuantity: null, reason: "Insufficient data" };
}

export function evaluateSeries(candles: PrimeCandle[], mode: "FAST PRIME" | "QUALITY PRIME" = "QUALITY PRIME") {
  return candles.map((_, i) => evaluatePrimeAt(candles, i, mode));
}
