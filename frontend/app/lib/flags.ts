export function countryCodeToFlagEmoji(countryCode?: string | null) {
  if (!countryCode) return "";

  const code = countryCode.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(code)) return "";

  return code
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}