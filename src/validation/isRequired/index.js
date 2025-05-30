/**
 * Checks if a value is provided (not null, not an empty string, not undefined).
 * For strings, it trims whitespace before checking for emptiness.
 *
 * @param {any} value - The value to check.
 * @param {string} [label="This field"] - The label of the field, used in the default error message.
 * @param {string} [customErrorMsg] - A custom error message to return if validation fails.
 * @returns {boolean|string} True if the value is provided, otherwise an error message string.
 */
export default function isRequired(
  value,
  label = "This field",
  customErrorMsg
) {
  // Trim the value if it's a string before checking
  const checkValue = typeof value === 'string' ? value.trim() : value;
  if (checkValue !== null && checkValue !== "" && checkValue !== undefined) {
    return true;
  }
  if (!!customErrorMsg && typeof customErrorMsg == "string") {
    return customErrorMsg;
  }
  return `Field ${label} is required.`;
}
