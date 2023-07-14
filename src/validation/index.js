import isRequired from "./isRequired";
import {
  matchRegex,
  isEmail,
  isDomain,
  isIPv4Address,
  isIPv6Address,
} from "./regexValidations";

export default {
  required: isRequired,
  email: isEmail,
  domain: isDomain,
  ipv4: isIPv4Address,
  ipv6: isIPv6Address,
  matchRegex,
};
