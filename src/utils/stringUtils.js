/**
 * Capitalizes the first letter of each word in a string.
 * Used for display of names stored in lowercase (e.g. entered via CLI).
 *
 * @param {string} str
 * @returns {string}
 */
export function capitalizeWords(str) {
  if (!str) return str;
  return str.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
