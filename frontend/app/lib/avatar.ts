export function getInitials(name: string) {
  if (!name) return "?";

  const parts = name.split(" ");

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0][0] + parts[parts.length - 1][0]
  ).toUpperCase();
}

export function getColorFromName(name: string) {
  const colors = [
    "#f87171", "#fb923c", "#fbbf24",
    "#34d399", "#60a5fa", "#a78bfa",
    "#f472b6"
  ];

  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
