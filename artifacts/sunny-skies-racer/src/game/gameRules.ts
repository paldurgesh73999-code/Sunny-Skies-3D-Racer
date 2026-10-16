export const LANE_COUNT = 3;
export const LANE_SPACING = 3.2;
export const STARTING_HEARTS = 3;

export type LevelRules = {
  level: number;
  goalDistance: number;
  speed: number;
  obstacleInterval: number;
  maxBlockedLanes: number;
  starLineLength: number;
};

export function getLevelRules(level: number): LevelRules {
  const safeLevel = Math.max(1, Math.floor(level));

  return {
    level: safeLevel,
    goalDistance: 260 + (safeLevel - 1) * 65,
    speed: 12 + (safeLevel - 1) * 0.85,
    obstacleInterval: Math.max(0.72, 2.8 - (safeLevel - 1) * 0.18),
    maxBlockedLanes: Math.min(2, 1 + Math.floor((safeLevel - 1) / 3)),
    starLineLength: Math.min(7, 3 + Math.floor((safeLevel - 1) / 2)),
  };
}

export function getDistanceProgress(distance: number, goalDistance: number) {
  if (goalDistance <= 0) return 1;
  return Math.min(1, Math.max(0, distance / goalDistance));
}

export function getAvailableLanes(blockedLanes: number[]) {
  return Array.from({ length: LANE_COUNT }, (_, index) => index).filter(
    (lane) => !blockedLanes.includes(lane),
  );
}

export function chooseObstacleLanes(level: number, random = Math.random) {
  const rules = getLevelRules(level);
  const lanes = Array.from({ length: LANE_COUNT }, (_, index) => index);

  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [lanes[index], lanes[swapIndex]] = [lanes[swapIndex], lanes[index]];
  }

  return lanes.slice(0, rules.maxBlockedLanes);
}

export function chooseStarLane(avoidLanes: number[], random = Math.random) {
  const openLanes = getAvailableLanes(avoidLanes);
  if (openLanes.length === 0) return 1;
  return openLanes[Math.floor(random() * openLanes.length)];
}
