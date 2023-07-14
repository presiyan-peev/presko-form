export function matchRegex(value, label, customErrorMsg, regex) {
  console.log({
    matchRegex: {
      value,
      label,
      customErrorMsg,
      regex,
    },
  });
}

export function isEmail(value, label, customErrorMsg) {
  return matchRegex(...arguments, "regex");
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
