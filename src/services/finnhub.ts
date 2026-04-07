/**
 * Macro Data Service
 *
 * Provides DXY (Dollar Index) data and Economic Calendar
 * for macro confluence analysis alongside crypto data.
 *
 * 100% FREE - No API keys required!
 * - DXY: Calculated from live forex rates via open.er-api.com
 * - Economic Calendar: Forex Factory public JSON feed
 *
 * @author AI Assistant
 * @createdDate 2026-04-06
 */

import axios from 'axios';
import logger from '../utils/Logger';
import NodeCache from 'node-cache';

// Cache: DXY 5 min, economic calendar 30 min
const cache = new NodeCache({ stdTTL: 300 });

// =============================================================================
// TYPES
// =============================================================================

export interface EconomicEvent {
  country: string;
  event: string;
  time: string;
  impact: 'high' | 'medium' | 'low';
  actual: string | null;
  estimate: string | null;
  previous: string | null;
}

export interface DXYData {
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: number;
  eurusd: number;
  gbpusd: number;
  usdjpy: number;
  usdcad: number;
  usdchf: number;
  usdsek: number;
}

// =============================================================================
// FOREX RATES (open.er-api.com - FREE, no key)
// =============================================================================

async function getForexRates(): Promise<Record<string, number>> {
  const cacheKey = 'forex_rates';
  const cached = cache.get<Record<string, number>>(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', {
      timeout: 10000,
    });
    const rates = data.rates || {};
    cache.set(cacheKey, rates, 300); // 5 min cache
    return rates;
  } catch (error: any) {
    logger.error('Forex rates error:', error.message);
    throw error;
  }
}

// =============================================================================
// DXY CALCULATION
// =============================================================================
// DXY = 50.14348112 * EURUSD^(-0.576) * USDJPY^(0.136) * GBPUSD^(-0.119)
//        * USDCAD^(0.091) * USDSEK^(0.042) * USDCHF^(0.036)

const DXY_CONSTANT = 50.14348112;

export async function getDXYData(): Promise<DXYData> {
  const cacheKey = 'dxy_data';
  const cached = cache.get<DXYData>(cacheKey);
  if (cached) return cached;

  try {
    const rates = await getForexRates();

    const eurusd = rates['EUR'] ? 1 / rates['EUR'] : 0;
    const usdjpy = rates['JPY'] || 0;
    const gbpusd = rates['GBP'] ? 1 / rates['GBP'] : 0;
    const usdcad = rates['CAD'] || 0;
    const usdsek = rates['SEK'] || 0;
    const usdchf = rates['CHF'] || 0;

    let dxy = DXY_CONSTANT;
    if (eurusd > 0) dxy *= Math.pow(eurusd, -0.576);
    if (usdjpy > 0) dxy *= Math.pow(usdjpy, 0.136);
    if (gbpusd > 0) dxy *= Math.pow(gbpusd, -0.119);
    if (usdcad > 0) dxy *= Math.pow(usdcad, 0.091);
    if (usdsek > 0) dxy *= Math.pow(usdsek, 0.042);
    if (usdchf > 0) dxy *= Math.pow(usdchf, 0.036);

    const result: DXYData = {
      price: parseFloat(dxy.toFixed(3)),
      change: 0,
      changePercent: 0,
      high: parseFloat(dxy.toFixed(3)),
      low: parseFloat(dxy.toFixed(3)),
      timestamp: Date.now(),
      eurusd: parseFloat(eurusd.toFixed(5)),
      gbpusd: parseFloat(gbpusd.toFixed(5)),
      usdjpy: parseFloat(usdjpy.toFixed(3)),
      usdcad: parseFloat(usdcad.toFixed(5)),
      usdchf: parseFloat(usdchf.toFixed(5)),
      usdsek: parseFloat(usdsek.toFixed(5)),
    };

    cache.set(cacheKey, result, 300);
    return result;
  } catch (error: any) {
    logger.error('DXY calculation error:', error.message);
    return {
      price: 0, change: 0, changePercent: 0, high: 0, low: 0,
      timestamp: Date.now(),
      eurusd: 0, gbpusd: 0, usdjpy: 0, usdcad: 0, usdchf: 0, usdsek: 0,
    };
  }
}

// =============================================================================
// ECONOMIC CALENDAR (Forex Factory public JSON - FREE, no key)
// =============================================================================

interface FFEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
  actual?: string;
}

export async function getEconomicCalendar(): Promise<EconomicEvent[]> {
  const cacheKey = 'economic_calendar';
  const cached = cache.get<EconomicEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.get<FFEvent[]>(
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      { timeout: 10000 }
    );

    const events: EconomicEvent[] = data
      .filter((e) => e.country === 'USD')
      .map((e) => ({
        country: 'US',
        event: e.title || '',
        time: e.date || '',
        impact: (e.impact?.toLowerCase() || 'low') as 'high' | 'medium' | 'low',
        actual: e.actual || null,
        estimate: e.forecast || null,
        previous: e.previous || null,
      }))
      .sort((a, b) => {
        const impactOrder = { high: 0, medium: 1, low: 2 };
        const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
        if (impactDiff !== 0) return impactDiff;
        return a.time.localeCompare(b.time);
      });

    cache.set(cacheKey, events, 1800); // 30 min cache
    return events;
  } catch (error: any) {
    logger.error('Economic calendar error:', error.message);
    return [];
  }
}

// =============================================================================
// COMBINED MACRO DATA FOR AI PROMPT
// =============================================================================

export interface MacroContext {
  dxy: DXYData;
  upcomingEvents: EconomicEvent[];
  highImpactEvents: EconomicEvent[];
  macroSummary: string;
}

export async function getMacroContext(): Promise<MacroContext> {
  const [dxy, events] = await Promise.all([
    getDXYData(),
    getEconomicCalendar(),
  ]);

  const highImpactEvents = events.filter((e) => e.impact === 'high');

  const dxySummary = dxy.price > 0
    ? `DXY at ${dxy.price} (EUR/USD: ${dxy.eurusd}, GBP/USD: ${dxy.gbpusd}, USD/JPY: ${dxy.usdjpy})`
    : 'DXY data unavailable';

  const eventsSummary = highImpactEvents.length > 0
    ? highImpactEvents
        .slice(0, 5)
        .map((e) => {
          const parts = [`${e.event} (${e.time})`];
          if (e.estimate) parts.push(`Est: ${e.estimate}`);
          if (e.previous) parts.push(`Prev: ${e.previous}`);
          if (e.actual) parts.push(`Act: ${e.actual}`);
          return parts.join(' | ');
        })
        .join('\n')
    : 'No high-impact US events this week';

  return {
    dxy,
    upcomingEvents: events.slice(0, 15),
    highImpactEvents,
    macroSummary: `${dxySummary}\n\nUpcoming High-Impact US Economic Events:\n${eventsSummary}`,
  };
}
