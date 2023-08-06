export function matchRegex(value, label = "This field", customErrorMsg, regex) {
  const isValid = value.match(regex);

  console.log({ value, label, customErrorMsg });
  if (isValid == true) {
    return true;
  }
  if (!!customErrorMsg && typeof customErrorMsg == "string") {
    return customErrorMsg;
  }
  return `${label} is not valid`;
}

export function isEmail(value, label, customErrorMsg) {
  const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])*$/;
  return matchRegex(...arguments, EMAIL_REGEX);
}

export function isDomain(value, label, customErrorMsg) {
  return matchRegex(...arguments, "regex");
}

export function isIPv4Address(value, label, customErrorMsg) {
  return matchRegex(...arguments, "regex");
}

export function isIPv6Address(value, label, customErrorMsg) {
  return matchRegex(...arguments, "regex");
}
