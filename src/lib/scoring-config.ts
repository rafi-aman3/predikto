export type ScoringConfig = {
  ptsExact: number; ptsResult: number;
  ptsReachR16: number; ptsReachQf: number; ptsReachSf: number; ptsReachFinal: number;
  ptsChampion: number; ptsRunnerUp: number; ptsGoldenBoot: number;
  ptsBestPlayer: number; ptsSurprise: number;
};

export const DEFAULT_SCORING: ScoringConfig = {
  ptsExact: 3, ptsResult: 1,
  ptsReachR16: 1, ptsReachQf: 2, ptsReachSf: 3, ptsReachFinal: 5,
  ptsChampion: 10, ptsRunnerUp: 5, ptsGoldenBoot: 5,
  ptsBestPlayer: 5, ptsSurprise: 5,
};
