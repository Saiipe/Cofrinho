import type { DayKey } from './types';

/**
 * Lucky garden: recording earns coins, coins water a plant, a grown plant yields luck points
 * that accumulate over time and are harvested. Pure rules; persistence lives in services/garden.
 */

export interface GardenState {
  coins: number;
  growth: number;
  luck: number;
  lastHarvestAt: number;
  lastRewardDay: DayKey | null;
}

export const INITIAL_GARDEN: GardenState = { coins: 20, growth: 0, luck: 0, lastHarvestAt: 0, lastRewardDay: null };

/** Growth needed to reach each stage (0 = seed … 6 = lucky tree). */
export const STAGE_THRESHOLDS = [0, 40, 100, 190, 310, 470, 680];
export const MAX_STAGE = STAGE_THRESHOLDS.length - 1;
export const WATER_COST = 10;
export const WATER_GROWTH = 12;
/** Luck points produced per hour at each stage. */
const LUCK_PER_HOUR = [0, 0.25, 0.5, 1, 1.5, 2, 3];
/** Uncollected luck stops accumulating after a day, so returning daily is rewarded. */
const MAX_PENDING_HOURS = 24;

export function stageFor(growth: number): number {
  let stage = 0;
  STAGE_THRESHOLDS.forEach((threshold, index) => {
    if (growth >= threshold) stage = index;
  });
  return stage;
}

export function stageProgress(growth: number): { stage: number; ratio: number } {
  const stage = stageFor(growth);
  if (stage === MAX_STAGE) return { stage, ratio: 1 };
  const from = STAGE_THRESHOLDS[stage]!;
  const to = STAGE_THRESHOLDS[stage + 1]!;
  return { stage, ratio: (growth - from) / (to - from) };
}

export type RewardReason = 'first' | 'streak' | 'milestone';

export function rewardForRecord(state: GardenState, context: { today: DayKey; streak: number; totalRecords: number }): { coins: number; reasons: RewardReason[]; next: GardenState } {
  let coins = 2;
  const reasons: RewardReason[] = [];
  if (state.lastRewardDay !== context.today) {
    coins += 10;
    reasons.push('first');
    if (context.streak >= 2) {
      coins += 2 * Math.min(context.streak, 10);
      reasons.push('streak');
    }
  }
  if (context.totalRecords > 0 && context.totalRecords % 50 === 0) {
    coins += 30;
    reasons.push('milestone');
  }
  return { coins, reasons, next: { ...state, coins: state.coins + coins, lastRewardDay: context.today } };
}

export function waterPlant(state: GardenState, now: number): GardenState | null {
  if (state.coins < WATER_COST || stageFor(state.growth) === MAX_STAGE) return null;
  // Harvest-clock starts once the plant can produce, so early luck isn't lost.
  const lastHarvestAt = state.lastHarvestAt || now;
  return { ...state, coins: state.coins - WATER_COST, growth: state.growth + WATER_GROWTH, lastHarvestAt };
}

export function pendingLuck(state: GardenState, now: number): number {
  if (!state.lastHarvestAt) return 0;
  const hours = Math.min(MAX_PENDING_HOURS, Math.max(0, (now - state.lastHarvestAt) / 3_600_000));
  return Math.floor(hours * LUCK_PER_HOUR[stageFor(state.growth)]!);
}

export function harvest(state: GardenState, now: number): { amount: number; next: GardenState } {
  const amount = pendingLuck(state, now);
  if (amount === 0) return { amount, next: state };
  return { amount, next: { ...state, luck: state.luck + amount, lastHarvestAt: now } };
}
