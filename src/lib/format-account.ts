/** Display 16-digit account numbers in four groups (card-style). Pass-through if not 16 digits. */
export function formatCardStyleAccountNumber(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 16) return raw;
  return d.replace(/(.{4})/g, "$1 ").trim();
}
