import { Day } from '../model/Day.js';

/**
 * Today in the time zone of the device. One `Date`, so the day cannot change between the parts.
 * @returns {Day}
 */
export function today() {
  const now = new Date();
  return Day.of(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
