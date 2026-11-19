// The ids of new metrics.

/** Ids that a new metric does not get: the headers of the `date` and `Score` columns of the `Log` tab. */
const reservedIds = new Set(['date', 'score']);

/** Letters with accents, and the same letters without accents. */
const plainLetters = new Map(
  [
    ['a', 'àáâãäåā'],
    ['c', 'çć'],
    ['e', 'èéêëē'],
    ['i', 'ìíîïī'],
    ['n', 'ñń'],
    ['o', 'òóôõöøō'],
    ['u', 'ùúûüū'],
    ['y', 'ýÿ'],
    ['ss', 'ß'],
    ['ae', 'æ'],
    ['oe', 'œ'],
  ].flatMap(([plain, letters]) => Array.from(letters, (letter) => [letter, plain])),
);

/**
 * The id of a new metric with the name `name`: lowercase letters and digits, with `_` between the words. If `taken`
 * has the id, a number goes after it. Each id in `taken` is an id of a metric, of an invalid row or of a `Log` column:
 * a new metric must not get the values of a deleted metric.
 *
 * Examples: "Morning teeth" gives `morning_teeth`. "Água" gives `agua`. With `water` in `taken`, "Water" gives
 * `water_2`. A name without letters or digits gives `metric`.
 * @param {string} name
 * @param {Set<string>} taken
 * @returns {string}
 */
export function newMetricId(name, taken) {
  const plain = Array.from(name.toLowerCase(), (c) => plainLetters.get(c) ?? c).join('');
  const base =
    plain
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40)
      .replace(/_+$/, '') || 'metric';
  /**
   * @param {string} id
   * @returns {boolean} True if no metric has the id.
   */
  const isFree = (id) => !taken.has(id) && !reservedIds.has(id);
  if (isFree(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}_${n}`;
    if (isFree(id)) return id;
  }
}
