export default function isRequired(
  value,
  label = "This field",
  customErrorMsg
) {
  if (value !== null && value !== "" && value !== undefined) {
    return true;
  }
  if (!!customErrorMsg && typeof customErrorMsg == "string") {
    return customErrorMsg;
  }
  return `${label} is required`;
}
