import isRequired from "./isRequired";
import {
  matchRegex,
  isEmail,
  isDomain,
  isIPv4Address,
  isIPv6Address,
  isString,
} from "./regexValidations";

export default {
  isRequired: isRequired,
  required: isRequired,
  string: isString,
  email: isEmail,
  domain: isDomain,
  ipv4: isIPv4Address,
  ipv6: isIPv6Address,
  matchRegex,
};
