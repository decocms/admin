export function color(id: string) {
  const colors = [
    "#FF6B6B", // coral red
    "#4ECDC4", // turquoise
    "#45B7D1", // sky blue
    "#96CEB4", // sage green
    "#FFEEAD", // cream
    "#D4A5A5", // dusty rose
    "#9B59B6", // purple
    "#3498DB", // blue
    "#E67E22", // orange
    "#2ECC71", // emerald
    "#F1C40F", // yellow
    "#1ABC9C", // teal
    "#E74C3C", // red
    "#34495E", // navy
    "#16A085", // green
    "#D35400", // dark orange
    "#8E44AD", // violet
    "#2980B9", // dark blue
    "#27AE60", // forest green
    "#C0392B", // burgundy
  ];

  const seed = id.split("-")[0];
  const hash = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
