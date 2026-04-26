export function generateUserCode(countryCode: string) {
  const prefix = countryCode.toUpperCase().slice(0, 2);

  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";

  let randomPart = "";

  for (let i = 0; i < 4; i++) {
    randomPart += chars[Math.floor(Math.random() * chars.length)];
  }

  return prefix + randomPart;
}
