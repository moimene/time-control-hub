export const AUTONOMOUS_COMMUNITIES = [
  { code: "AND", name: "Andalucía" },
  { code: "ARA", name: "Aragón" },
  { code: "AST", name: "Asturias" },
  { code: "BAL", name: "Islas Baleares" },
  { code: "CAN", name: "Canarias" },
  { code: "CNT", name: "Cantabria" },
  { code: "CYL", name: "Castilla y León" },
  { code: "CLM", name: "Castilla-La Mancha" },
  { code: "CAT", name: "Cataluña" },
  { code: "EXT", name: "Extremadura" },
  { code: "GAL", name: "Galicia" },
  { code: "MAD", name: "Madrid" },
  { code: "MUR", name: "Región de Murcia" },
  { code: "NAV", name: "Navarra" },
  { code: "PVA", name: "País Vasco" },
  { code: "RIO", name: "La Rioja" },
  { code: "VAL", name: "Comunidad Valenciana" },
  { code: "CEU", name: "Ceuta" },
  { code: "MEL", name: "Melilla" },
] as const;

export type AutonomousCommunityCode = typeof AUTONOMOUS_COMMUNITIES[number]['code'];

export function getAutonomousCommunityName(code: string | null | undefined): string {
  if (!code) return '';
  const community = AUTONOMOUS_COMMUNITIES.find(c => c.code === code);
  return community?.name || code;
}
