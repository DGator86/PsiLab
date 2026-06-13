/**
 * Honest statistics for drill results. No vibes, just math.
 */

/** Wilson score interval for a binomial proportion (default 95%). */
export function wilsonInterval(
  hits: number,
  n: number,
  z = 1.959964,
): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const p = hits / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

/** log Gamma via Lanczos approximation. */
function logGamma(x: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < g.length; i++) {
    a += g[i] / (x + i + 1);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function logBinomPmf(k: number, n: number, p: number): number {
  return (
    logGamma(n + 1) -
    logGamma(k + 1) -
    logGamma(n - k + 1) +
    k * Math.log(p) +
    (n - k) * Math.log(1 - p)
  );
}

/** z-score of an observed hit count against a binomial chance baseline. */
export function binomialZ(hits: number, n: number, p: number): number {
  if (n === 0) return 0;
  return (hits - n * p) / Math.sqrt(n * p * (1 - p));
}

/**
 * Sequential probability ratio test (Wald) of H0: rate = chance vs
 * H1: rate = chance + delta, with standard alpha = beta = 0.05 boundaries.
 * Returns the running verdict for a preregistered run.
 */
export function sprtVerdict(
  hits: number,
  n: number,
  chance: number,
  delta = 0.1,
): "accept-h1" | "accept-h0" | "continue" {
  if (n === 0) return "continue";
  const p1 = Math.min(0.999, chance + delta);
  const llr =
    hits * Math.log(p1 / chance) +
    (n - hits) * Math.log((1 - p1) / (1 - chance));
  const a = Math.log((1 - 0.05) / 0.05); // upper boundary
  const b = Math.log(0.05 / (1 - 0.05)); // lower boundary
  if (llr >= a) return "accept-h1";
  if (llr <= b) return "accept-h0";
  return "continue";
}

/**
 * Exact two-sided binomial test (method of small p-values):
 * sums P(X = k) over all k whose probability does not exceed P(X = observed).
 */
export function binomialTwoSidedP(hits: number, n: number, p: number): number {
  if (n === 0) return 1;
  const observed = logBinomPmf(hits, n, p);
  const epsilon = 1e-12;
  let total = 0;
  for (let k = 0; k <= n; k++) {
    const lp = logBinomPmf(k, n, p);
    if (lp <= observed + epsilon) total += Math.exp(lp);
  }
  return Math.min(1, total);
}
