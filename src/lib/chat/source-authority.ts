export function isOfficialRegulatoryDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return (
    d.endsWith(".gov") ||
    d.includes(".gov.") ||
    d.endsWith(".mil") ||
    d.endsWith(".europa.eu") ||
    d === "who.int" ||
    d === "iso.org" ||
    d === "un.org"
  );
}
