/** Deterministic warm Reverie portrait gradient from a seed string. */
export function gradientFor(seed: string): string {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
    return `radial-gradient(120% 90% at 35% 25%, hsl(${h} 38% 30%), hsl(${(h + 30) % 360} 42% 16%) 60%, #160f24)`
}
