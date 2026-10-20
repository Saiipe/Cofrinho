import { db } from '@/data/db';
import { readKv, writeKv } from '@/data/settings';
import { todayKey } from '@/domain/dates';
import { INITIAL_GARDEN, harvest, rewardForRecord, waterPlant, type GardenState, type RewardReason } from '@/domain/garden';
import { recordingStats } from '@/domain/stats';

const GARDEN_KEY = 'garden';

export function getGarden(): Promise<GardenState> {
  return readKv(GARDEN_KEY, INITIAL_GARDEN);
}

/** Called after the user creates a record by hand; returns what was earned for the toast. */
export async function rewardRecording(now = Date.now()): Promise<{ coins: number; reasons: RewardReason[]; streak: number; totalRecords: number }> {
  const createdAt = (await db.transactions.orderBy('createdAt').keys()) as number[];
  const today = todayKey(now);
  const stats = recordingStats(createdAt, today);
  const reward = rewardForRecord(await getGarden(), { today, streak: stats.streak, totalRecords: stats.totalRecords });
  await writeKv(GARDEN_KEY, reward.next);
  return { coins: reward.coins, reasons: reward.reasons, streak: stats.streak, totalRecords: stats.totalRecords };
}

export async function water(now = Date.now()): Promise<GardenState | null> {
  const next = waterPlant(await getGarden(), now);
  if (next) await writeKv(GARDEN_KEY, next);
  return next;
}

export async function harvestLuck(now = Date.now()): Promise<number> {
  const result = harvest(await getGarden(), now);
  if (result.amount) await writeKv(GARDEN_KEY, result.next);
  return result.amount;
}
