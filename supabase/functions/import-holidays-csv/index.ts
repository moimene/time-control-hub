import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeo de nombres de comunidades a códigos internos
const REGION_MAP: Record<string, string> = {
  'Andalucía': 'AND',
  'Aragón': 'ARA',
  'Aragon': 'ARA',
  'Asturias': 'AST',
  'Baleares': 'BAL',
  'Islas Baleares': 'BAL',
  'Canarias': 'CAN',
  'Cantabria': 'CNT',
  'Castilla y León': 'CYL',
  'Castilla-La Mancha': 'CLM',
  'Cataluña': 'CAT',
  'Catalunya': 'CAT',
  'Extremadura': 'EXT',
  'Galicia': 'GAL',
  'Madrid': 'MAD',
  'Comunidad de Madrid': 'MAD',
  'Murcia': 'MUR',
  'Región de Murcia': 'MUR',
  'Navarra': 'NAV',
  'País Vasco': 'PVA',
  'Euskadi': 'PVA',
  'La Rioja': 'RIO',
  'Comunidad Valenciana': 'VAL',
  'Valencia': 'VAL',
  'Ceuta': 'CEU',
  'Melilla': 'MEL',
};

// Mapeo de niveles del CSV a tipos internos
const LEVEL_MAP: Record<string, string> = {
  'national': 'nacional',
  'autonomous': 'autonomico',
  'local': 'local',
};

interface CsvRow {
  anio: string;
  fecha: string;
  nombre: string;
  nivel: string;
  comunidad_autonoma: string;
  provincia: string;
  municipio: string;
  isla: string;
  fuente: string;
}

function parseCSV(csvText: string): CsvRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: CsvRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      rows.push({
        anio: values[headers.indexOf('anio')] || values[0] || '',
        fecha: values[headers.indexOf('fecha')] || values[1] || '',
        nombre: values[headers.indexOf('nombre')] || values[2] || '',
        nivel: values[headers.indexOf('nivel')] || values[3] || '',
        comunidad_autonoma: values[headers.indexOf('comunidad_autonoma')] || values[4] || '',
        provincia: values[headers.indexOf('provincia')] || values[5] || '',
        municipio: values[headers.indexOf('municipio')] || values[6] || '',
        isla: values[headers.indexOf('isla')] || values[7] || '',
        fuente: values[headers.indexOf('fuente')] || values[8] || '',
      });
    }
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { csvContent, year, replaceExisting = false } = await req.json();
    
    if (!csvContent) {
      return new Response(JSON.stringify({ error: 'No CSV content provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Parsing CSV content...');
    const rows = parseCSV(csvContent);
    console.log(`Parsed ${rows.length} rows from CSV`);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid rows found in CSV' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If replaceExisting, delete existing holidays for the year
    if (replaceExisting && year) {
      console.log(`Deleting existing holidays for year ${year}...`);
      const { error: deleteError } = await supabase
        .from('national_holidays')
        .delete()
        .eq('year', year);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
      }
    }

    // Transform and insert rows
    const stats = {
      total: rows.length,
      inserted: 0,
      skipped: 0,
      errors: 0,
      byLevel: { national: 0, autonomous: 0, local: 0 }
    };

    for (const row of rows) {
      try {
        const yearNum = parseInt(row.anio);
        if (isNaN(yearNum)) {
          stats.skipped++;
          continue;
        }

        // Skip if filtering by year and doesn't match
        if (year && yearNum !== year) {
          stats.skipped++;
          continue;
        }

        const level = LEVEL_MAP[row.nivel] || row.nivel || 'nacional';
        const region = REGION_MAP[row.comunidad_autonoma] || row.comunidad_autonoma || null;
        
        const holidayData = {
          year: yearNum,
          holiday_date: row.fecha,
          name: row.nombre,
          type: level === 'local' ? 'autonomico' : level, // DB only has nacional/autonomico
          region: region,
          level: row.nivel || 'national',
          province: row.provincia || null,
          municipality: row.municipio || null,
          island: row.isla || null,
          source: row.fuente || null,
        };

        // Try to upsert
        const { error } = await supabase
          .from('national_holidays')
          .upsert(holidayData, {
            onConflict: 'year,holiday_date,type,region',
            ignoreDuplicates: true
          });

        if (error) {
          // Try insert if upsert fails (may be unique constraint issues)
          const { error: insertError } = await supabase
            .from('national_holidays')
            .insert(holidayData);
          
          if (insertError) {
            if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
              stats.skipped++;
            } else {
              console.error('Insert error:', insertError);
              stats.errors++;
            }
          } else {
            stats.inserted++;
            if (row.nivel === 'national') stats.byLevel.national++;
            else if (row.nivel === 'autonomous') stats.byLevel.autonomous++;
            else if (row.nivel === 'local') stats.byLevel.local++;
          }
        } else {
          stats.inserted++;
          if (row.nivel === 'national') stats.byLevel.national++;
          else if (row.nivel === 'autonomous') stats.byLevel.autonomous++;
          else if (row.nivel === 'local') stats.byLevel.local++;
        }
      } catch (rowError) {
        console.error('Row processing error:', rowError, row);
        stats.errors++;
      }
    }

    console.log('Import complete:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Import failed';
    return new Response(JSON.stringify({ 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
