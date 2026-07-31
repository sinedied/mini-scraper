export const stats = {
  matches: {
    perfect: 0,
    partial: 0,
    ai: 0,
    none: 0
  },
  skipped: 0,
  startTime: 0
};

export function resetStats() {
  stats.matches.perfect = 0;
  stats.matches.partial = 0;
  stats.matches.ai = 0;
  stats.matches.none = 0;
  stats.skipped = 0;
  stats.startTime = 0;
}
