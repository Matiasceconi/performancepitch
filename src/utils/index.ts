export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

/**
 * Formats a GPS/numeric metric value:
 * - Removes trailing zeros from decimal part
 * - Never rounds (uses string manipulation)
 * - Returns "—" for null/undefined/NaN
 * - Example: 40.110000 → "40.11", 12.000000 → "12"
 */
export function fmtMetric(value: number | undefined | null): string {
    if (value === undefined || value === null || value === "") return "—";
    const n = typeof value === "number" ? value : parseFloat(value as any);
    if (isNaN(n)) return "—";
    // Convert to string with enough precision to avoid scientific notation
    let s = n.toPrecision(15).replace(/e[+-]?\d+/, "");
    // If decimal present, strip trailing zeros then trailing dot
    if (s.includes(".")) {
        s = s.replace(/0+$/, "").replace(/\.$/, "");
    }
    return s;
}