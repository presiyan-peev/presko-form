export function matchRegex(value, label = "This field", customErrorMsg, regex) {
  const isValid = regex.test(value);

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
  console.log({ EMAIL_REGEX });
  return matchRegex(value, label, customErrorMsg, EMAIL_REGEX);
}

export function isDomain(value, label, customErrorMsg) {
  const DOMAIN_REGEX =
    /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*(\.[A-Za-z]{2,6})$/;
  return matchRegex(value, label, customErrorMsg, DOMAIN_REGEX);
}

export function isIPv4Address(value, label, customErrorMsg) {
  const IPV4_REGEX =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return matchRegex(value, label, customErrorMsg, IPV4_REGEX);
}

export function isIPv6Address(value, label, customErrorMsg) {
  const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)$/;
  return matchRegex(value, label, customErrorMsg, IPV6_REGEX);
}
