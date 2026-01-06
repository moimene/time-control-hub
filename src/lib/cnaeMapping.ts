// CNAE code to sector mapping
// Groups common CNAE codes by business sector

export interface CNAEMapping {
  code: string;
  description: string;
  sector: string;
}

// Comprehensive CNAE → Sector mapping
export const CNAE_SECTOR_MAP: Record<string, string> = {
  // Hostelería (55, 56)
  '55': 'hosteleria',
  '551': 'hosteleria',
  '5510': 'hosteleria', // Hoteles y alojamientos similares
  '5520': 'hosteleria', // Alojamientos turísticos
  '5530': 'hosteleria', // Campings
  '5590': 'hosteleria', // Otros alojamientos
  '56': 'hosteleria',
  '561': 'hosteleria',
  '5610': 'hosteleria', // Restaurantes
  '562': 'hosteleria',
  '5621': 'hosteleria', // Provisión de comidas preparadas
  '5629': 'hosteleria', // Otros servicios de comidas
  '563': 'hosteleria',
  '5630': 'hosteleria', // Establecimientos de bebidas

  // Comercio minorista (47)
  '47': 'comercio',
  '4711': 'comercio_alimentacion', // Comercio al por menor en establecimientos no especializados, con predominio en productos alimenticios
  '4719': 'comercio', // Otro comercio al por menor en establecimientos no especializados
  '472': 'comercio_alimentacion',
  '4721': 'comercio_alimentacion', // Frutas y verduras
  '4722': 'comercio_alimentacion', // Carnes
  '4723': 'comercio_alimentacion', // Pescados
  '4724': 'comercio_alimentacion', // Pan y panadería
  '4725': 'comercio_alimentacion', // Bebidas
  '4729': 'comercio_alimentacion', // Otro comercio alimentación
  '473': 'comercio', // Combustible
  '474': 'comercio', // Equipos TIC
  '4741': 'comercio',
  '4742': 'comercio',
  '4743': 'comercio',
  '475': 'comercio', // Otros artículos domésticos
  '476': 'comercio', // Artículos culturales y recreativos
  '477': 'comercio', // Otros artículos nuevos
  '4771': 'comercio', // Prendas de vestir
  '4772': 'comercio', // Calzado y cuero
  '4773': 'comercio', // Farmacia
  '4774': 'comercio', // Artículos médicos y ortopédicos
  '4775': 'comercio', // Cosméticos
  '4776': 'comercio', // Flores y plantas
  '4777': 'comercio', // Relojería y joyería
  '4778': 'comercio', // Otros comercio especializado
  '4779': 'comercio', // Segunda mano
  '478': 'comercio', // Comercio ambulante
  '479': 'comercio', // Comercio no realizado en establecimientos

  // Comercio al por mayor (46) - similar a comercio
  '46': 'comercio',
  '461': 'comercio',
  '462': 'comercio',
  '463': 'comercio_alimentacion',
  '464': 'comercio',
  '465': 'comercio',
  '466': 'comercio',
  '467': 'comercio',
  '469': 'comercio',

  // Sanidad (86)
  '86': 'salud',
  '861': 'salud',
  '8610': 'salud', // Actividades hospitalarias
  '862': 'salud',
  '8621': 'salud', // Actividades de medicina general
  '8622': 'salud', // Actividades de medicina especializada
  '8623': 'salud', // Actividades odontológicas
  '869': 'salud',
  '8690': 'salud', // Otras actividades sanitarias

  // Veterinaria (75)
  '75': 'veterinaria',
  '7500': 'veterinaria',

  // Servicios profesionales / Oficinas (69, 70, 71, 73, 74)
  '69': 'servicios_profesionales',
  '6910': 'servicios_profesionales', // Actividades jurídicas
  '6920': 'servicios_profesionales', // Contabilidad y auditoría
  '70': 'consultoria',
  '7010': 'consultoria', // Sedes centrales
  '7021': 'consultoria', // Relaciones públicas
  '7022': 'consultoria', // Consultoría empresarial
  '71': 'servicios_profesionales',
  '7111': 'servicios_profesionales', // Servicios técnicos de arquitectura
  '7112': 'servicios_profesionales', // Servicios técnicos de ingeniería
  '712': 'servicios_profesionales',
  '7120': 'servicios_profesionales', // Ensayos y análisis técnicos
  '73': 'consultoria',
  '7311': 'consultoria', // Agencias de publicidad
  '7312': 'consultoria', // Servicios de representación de medios
  '732': 'consultoria',
  '7320': 'consultoria', // Estudios de mercado
  '74': 'servicios_profesionales',
  '7410': 'servicios_profesionales', // Diseño especializado
  '7420': 'servicios_profesionales', // Actividades de fotografía
  '7430': 'servicios_profesionales', // Traducción e interpretación
  '749': 'servicios_profesionales',
  '7490': 'servicios_profesionales', // Otras actividades profesionales

  // Metal (24, 25)
  '24': 'metal',
  '241': 'metal',
  '242': 'metal',
  '243': 'metal',
  '244': 'metal',
  '245': 'metal',
  '25': 'metal',
  '251': 'metal',
  '252': 'metal',
  '253': 'metal',
  '254': 'metal',
  '255': 'metal',
  '256': 'metal',
  '257': 'metal',
  '259': 'metal',

  // Construcción (41, 42, 43)
  '41': 'construccion',
  '411': 'construccion',
  '4110': 'construccion', // Promoción inmobiliaria
  '412': 'construccion',
  '4121': 'construccion', // Construcción de edificios residenciales
  '4122': 'construccion', // Construcción de edificios no residenciales
  '42': 'construccion',
  '421': 'construccion',
  '4211': 'construccion', // Construcción de carreteras
  '4212': 'construccion', // Construcción de vías férreas
  '4213': 'construccion', // Construcción de puentes y túneles
  '422': 'construccion',
  '4221': 'construccion', // Construcción de redes de agua
  '4222': 'construccion', // Construcción de redes eléctricas
  '4291': 'construccion', // Obras hidráulicas
  '4299': 'construccion', // Otras obras de ingeniería civil
  '43': 'construccion',
  '431': 'construccion',
  '4311': 'construccion', // Demolición
  '4312': 'construccion', // Preparación de terrenos
  '4313': 'construccion', // Perforaciones y sondeos
  '432': 'construccion',
  '4321': 'construccion', // Instalaciones eléctricas
  '4322': 'construccion', // Fontanería, calefacción
  '4329': 'construccion', // Otras instalaciones
  '433': 'construccion',
  '4331': 'construccion', // Revocamiento
  '4332': 'construccion', // Carpintería
  '4333': 'construccion', // Revestimiento suelos y paredes
  '4334': 'construccion', // Pintura y acristalamiento
  '4339': 'construccion', // Otros acabados
  '439': 'construccion',
  '4391': 'construccion', // Construcción de cubiertas
  '4399': 'construccion', // Otras construcciones especializadas

  // Limpieza (81)
  '81': 'limpieza',
  '811': 'limpieza',
  '8110': 'limpieza', // Servicios integrales a edificios
  '812': 'limpieza',
  '8121': 'limpieza', // Limpieza general de edificios
  '8122': 'limpieza', // Otras actividades de limpieza industrial
  '8129': 'limpieza', // Otras actividades de limpieza
  '813': 'limpieza',
  '8130': 'limpieza', // Jardinería

  // Tecnología / Informática (62, 63) → Consultoría
  '62': 'consultoria',
  '6201': 'consultoria', // Programación informática
  '6202': 'consultoria', // Consultoría informática
  '6203': 'consultoria', // Gestión de recursos informáticos
  '6209': 'consultoria', // Otros servicios informáticos
  '63': 'consultoria',
  '6311': 'consultoria', // Proceso de datos
  '6312': 'consultoria', // Portales web
  '6391': 'consultoria', // Actividades de agencias de noticias
  '6399': 'consultoria', // Otros servicios de información
};

// Get sector from CNAE code (tries exact match, then prefix matches)
export function getSectorFromCNAE(cnae: string): string | null {
  if (!cnae) return null;
  
  // Clean the CNAE code (remove dots, spaces)
  const cleanCNAE = cnae.replace(/[\.\s-]/g, '');
  
  // Try exact match first
  if (CNAE_SECTOR_MAP[cleanCNAE]) {
    return CNAE_SECTOR_MAP[cleanCNAE];
  }
  
  // Try progressively shorter prefixes (4, 3, 2 digits)
  for (let length = Math.min(4, cleanCNAE.length); length >= 2; length--) {
    const prefix = cleanCNAE.substring(0, length);
    if (CNAE_SECTOR_MAP[prefix]) {
      return CNAE_SECTOR_MAP[prefix];
    }
  }
  
  return null;
}

// Get suggested templates for a sector
export function getSuggestedSector(cnae: string): { sector: string; confidence: 'high' | 'medium' | 'low' } | null {
  const sector = getSectorFromCNAE(cnae);
  if (!sector) return null;
  
  const cleanCNAE = cnae.replace(/[\.\s-]/g, '');
  
  // Determine confidence based on match specificity
  if (CNAE_SECTOR_MAP[cleanCNAE]) {
    return { sector, confidence: 'high' };
  } else if (cleanCNAE.length >= 3 && CNAE_SECTOR_MAP[cleanCNAE.substring(0, 3)]) {
    return { sector, confidence: 'medium' };
  }
  return { sector, confidence: 'low' };
}
