import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Company definitions
const companies = [
  { name: 'Bar El Rincón', cif: 'B12345678', address: 'Calle Mayor 15', city: 'Madrid', postal_code: '28013', timezone: 'Europe/Madrid' },
  { name: 'Zapatería López', cif: 'B23456789', address: 'Av. de la Constitución 42', city: 'Sevilla', postal_code: '41001', timezone: 'Europe/Madrid' },
  { name: 'Clínica Dental Sonrisas', cif: 'B34567890', address: 'Paseo de Gracia 88', city: 'Barcelona', postal_code: '08008', timezone: 'Europe/Madrid' },
  { name: 'Fisioterapia Wellness', cif: 'B45678901', address: 'Gran Vía 120', city: 'Valencia', postal_code: '46021', timezone: 'Europe/Madrid' },
];

// Employee definitions by company index
const employeesByCompany = [
  // Bar El Rincón
  [
    { employee_code: 'BAR001', first_name: 'Juan', last_name: 'Martínez García', email: 'juan.martinez@elrincon.com', department: 'Sala', position: 'Camarero Jefe', status: 'active', pin: '1234' },
    { employee_code: 'BAR002', first_name: 'Ana', last_name: 'López Fernández', email: 'ana.lopez@elrincon.com', department: 'Sala', position: 'Camarera', status: 'active', pin: '2345' },
    { employee_code: 'BAR003', first_name: 'Pedro', last_name: 'Sánchez Ruiz', email: 'pedro.sanchez@elrincon.com', department: 'Cocina', position: 'Cocinero', status: 'active', pin: '3456' },
    { employee_code: 'BAR004', first_name: 'María', last_name: 'González Torres', email: 'maria.gonzalez@elrincon.com', department: 'Sala', position: 'Camarera', status: 'active', pin: '4567' },
    { employee_code: 'BAR005', first_name: 'Carlos', last_name: 'Jiménez Pérez', email: 'carlos.jimenez@elrincon.com', department: 'Sala', position: 'Camarero', status: 'on_leave', pin: '5678' },
  ],
  // Zapatería López
  [
    { employee_code: 'ZAP001', first_name: 'Lucía', last_name: 'Moreno Díaz', email: 'lucia.moreno@zapateria-lopez.com', department: 'Ventas', position: 'Encargada', status: 'active', pin: '1111' },
    { employee_code: 'ZAP002', first_name: 'Roberto', last_name: 'Navarro Soto', email: 'roberto.navarro@zapateria-lopez.com', department: 'Ventas', position: 'Dependiente', status: 'active', pin: '2222' },
    { employee_code: 'ZAP003', first_name: 'Elena', last_name: 'Castro Vega', email: 'elena.castro@zapateria-lopez.com', department: 'Almacén', position: 'Reponedora', status: 'active', pin: '3333' },
    { employee_code: 'ZAP004', first_name: 'Miguel', last_name: 'Romero Gil', email: 'miguel.romero@zapateria-lopez.com', department: 'Ventas', position: 'Dependiente', status: 'inactive', pin: '4444' },
  ],
  // Clínica Dental Sonrisas
  [
    { employee_code: 'DEN001', first_name: 'Alberto', last_name: 'Ruiz Martín', email: 'alberto.ruiz@dentalsonrisas.com', department: 'Clínica', position: 'Odontólogo Principal', status: 'active', pin: '1212' },
    { employee_code: 'DEN002', first_name: 'Carmen', last_name: 'Vidal López', email: 'carmen.vidal@dentalsonrisas.com', department: 'Clínica', position: 'Odontóloga', status: 'active', pin: '2323' },
    { employee_code: 'DEN003', first_name: 'Sofía', last_name: 'Herrera Blanco', email: 'sofia.herrera@dentalsonrisas.com', department: 'Clínica', position: 'Higienista Dental', status: 'active', pin: '3434' },
    { employee_code: 'DEN004', first_name: 'Pablo', last_name: 'Ortega Serrano', email: 'pablo.ortega@dentalsonrisas.com', department: 'Recepción', position: 'Recepcionista', status: 'active', pin: '4545' },
    { employee_code: 'DEN005', first_name: 'Marta', last_name: 'Iglesias Campos', email: 'marta.iglesias@dentalsonrisas.com', department: 'Clínica', position: 'Auxiliar Dental', status: 'on_leave', pin: '5656' },
  ],
  // Fisioterapia Wellness
  [
    { employee_code: 'FIS001', first_name: 'David', last_name: 'Molina Vargas', email: 'david.molina@fisio-wellness.com', department: 'Tratamientos', position: 'Fisioterapeuta Senior', status: 'active', pin: '6666' },
    { employee_code: 'FIS002', first_name: 'Laura', last_name: 'Gutiérrez Ramos', email: 'laura.gutierrez@fisio-wellness.com', department: 'Tratamientos', position: 'Fisioterapeuta', status: 'active', pin: '7777' },
    { employee_code: 'FIS003', first_name: 'Javier', last_name: 'Santos Prieto', email: 'javier.santos@fisio-wellness.com', department: 'Recepción', position: 'Recepcionista', status: 'active', pin: '8888' },
    { employee_code: 'FIS004', first_name: 'Claudia', last_name: 'Fernández Cruz', email: 'claudia.fernandez@fisio-wellness.com', department: 'Tratamientos', position: 'Fisioterapeuta Junior', status: 'active', pin: '9999' },
  ],
];

// Auth users by company index
const authUsersByCompany = [
  // Bar El Rincón
  { admin: { email: 'admin@elrincon.com', password: 'bar123' }, responsible: { email: 'responsable@elrincon.com', password: 'resp123' }, employees: ['BAR001', 'BAR002'] },
  // Zapatería López
  { admin: { email: 'admin@zapateria-lopez.com', password: 'zap123' }, responsible: { email: 'responsable@zapateria-lopez.com', password: 'resp123' }, employees: ['ZAP001', 'ZAP002'] },
  // Clínica Dental Sonrisas
  { admin: { email: 'admin@dentalsonrisas.com', password: 'den123' }, responsible: { email: 'responsable@dentalsonrisas.com', password: 'resp123' }, employees: ['DEN001', 'DEN003'] },
  // Fisioterapia Wellness
  { admin: { email: 'admin@fisio-wellness.com', password: 'fis123' }, responsible: { email: 'responsable@fisio-wellness.com', password: 'resp123' }, employees: ['FIS001', 'FIS002'] },
];

// Terminals by company
const terminalsByCompany = [
  { name: 'Terminal Barra', location: 'Entrada principal' },
  { name: 'Terminal Tienda', location: 'Mostrador' },
  { name: 'Terminal Recepción', location: 'Recepción clínica' },
  { name: 'Terminal Entrada', location: 'Hall principal' },
];

// Work schedules by company type (for realistic time events)
const schedulesByCompany = [
  // Bar: split shifts
  { morning: { start: 10, end: 17 }, evening: { start: 17, end: 24 } },
  // Zapatería: commercial hours
  { morning: { start: 10, end: 14 }, evening: { start: 17, end: 20.5 } },
  // Clínica Dental: consultation hours
  { morning: { start: 9, end: 14 }, evening: { start: 16, end: 20 } },
  // Fisioterapia: continuous or evening
  { morning: { start: 8, end: 15 }, evening: { start: 15, end: 21 } },
];

// Helper to hash PIN
async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to generate random salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to compute event hash
async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to add random minutes
function addRandomMinutes(baseHour: number, variance: number = 15): Date {
  const now = new Date();
  const date = new Date(now);
  date.setHours(Math.floor(baseHour), Math.floor((baseHour % 1) * 60), 0, 0);
  const randomMinutes = Math.floor(Math.random() * variance * 2) - variance;
  date.setMinutes(date.getMinutes() + randomMinutes);
  return date;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { clean = false } = await req.json().catch(() => ({}));
    const results: Record<string, unknown> = {};

    console.log('Starting test data setup...');

    // Step 1: Create companies
    console.log('Creating companies...');
    const companyIds: string[] = [];
    for (const company of companies) {
      const { data: existing } = await supabaseAdmin
        .from('company')
        .select('id')
        .eq('cif', company.cif)
        .maybeSingle();

      if (existing) {
        companyIds.push(existing.id);
        console.log(`Company ${company.name} already exists`);
      } else {
        const { data: newCompany, error } = await supabaseAdmin
          .from('company')
          .insert(company)
          .select('id')
          .single();

        if (error) throw new Error(`Error creating company ${company.name}: ${error.message}`);
        companyIds.push(newCompany.id);
        console.log(`Created company ${company.name}`);
      }
    }
    results.companies = companyIds.length;

    // Step 2: Create employees
    console.log('Creating employees...');
    const employeeMap: Record<string, { id: string; company_id: string }> = {};
    let employeeCount = 0;

    for (let i = 0; i < employeesByCompany.length; i++) {
      const companyId = companyIds[i];
      for (const emp of employeesByCompany[i]) {
        const { data: existing } = await supabaseAdmin
          .from('employees')
          .select('id')
          .eq('employee_code', emp.employee_code)
          .maybeSingle();

        if (existing) {
          employeeMap[emp.employee_code] = { id: existing.id, company_id: companyId };
          // Update company_id if missing
          await supabaseAdmin
            .from('employees')
            .update({ company_id: companyId })
            .eq('id', existing.id);
          console.log(`Employee ${emp.employee_code} already exists`);
        } else {
          const salt = generateSalt();
          const pinHash = await hashPin(emp.pin, salt);

          const { data: newEmp, error } = await supabaseAdmin
            .from('employees')
            .insert({
              employee_code: emp.employee_code,
              first_name: emp.first_name,
              last_name: emp.last_name,
              email: emp.email,
              department: emp.department,
              position: emp.position,
              status: emp.status,
              company_id: companyId,
              pin_hash: pinHash,
              pin_salt: salt,
              hire_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3).toISOString().split('T')[0],
            })
            .select('id')
            .single();

          if (error) throw new Error(`Error creating employee ${emp.employee_code}: ${error.message}`);
          employeeMap[emp.employee_code] = { id: newEmp.id, company_id: companyId };
          employeeCount++;
          console.log(`Created employee ${emp.employee_code}`);
        }
      }
    }
    results.employees = employeeCount;

    // Step 3: Create auth users
    console.log('Creating auth users...');
    let userCount = 0;

    // Super admin
    const superAdminEmail = 'superadmin@timecontrol.com';
    const { data: existingSuperAdmin } = await supabaseAdmin.auth.admin.listUsers();
    let superAdminId: string | null = existingSuperAdmin.users.find(u => u.email === superAdminEmail)?.id || null;

    if (!superAdminId) {
      const { data: newSuperAdmin, error } = await supabaseAdmin.auth.admin.createUser({
        email: superAdminEmail,
        password: 'super123',
        email_confirm: true,
      });
      if (!error && newSuperAdmin.user) {
        superAdminId = newSuperAdmin.user.id;
        userCount++;
      }
    }

    if (superAdminId) {
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', superAdminId)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (!existingRole) {
        await supabaseAdmin.from('user_roles').insert({ user_id: superAdminId, role: 'super_admin' });
      }
    }

    // Company users
    for (let i = 0; i < authUsersByCompany.length; i++) {
      const companyId = companyIds[i];
      const authUsers = authUsersByCompany[i];

      // Admin
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
      let adminUser = allUsers.users.find(u => u.email === authUsers.admin.email);

      if (!adminUser) {
        const { data: newAdmin } = await supabaseAdmin.auth.admin.createUser({
          email: authUsers.admin.email,
          password: authUsers.admin.password,
          email_confirm: true,
        });
        adminUser = newAdmin?.user || undefined;
        userCount++;
      }

      if (adminUser) {
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', adminUser.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (!existingRole) {
          await supabaseAdmin.from('user_roles').insert({ user_id: adminUser.id, role: 'admin' });
        }

        const { data: existingUc } = await supabaseAdmin
          .from('user_company')
          .select('id')
          .eq('user_id', adminUser.id)
          .eq('company_id', companyId)
          .maybeSingle();

        if (!existingUc) {
          await supabaseAdmin.from('user_company').insert({ user_id: adminUser.id, company_id: companyId });
        }
      }

      // Responsible
      let responsibleUser = allUsers.users.find(u => u.email === authUsers.responsible.email);

      if (!responsibleUser) {
        const { data: newResp } = await supabaseAdmin.auth.admin.createUser({
          email: authUsers.responsible.email,
          password: authUsers.responsible.password,
          email_confirm: true,
        });
        responsibleUser = newResp?.user || undefined;
        userCount++;
      }

      if (responsibleUser) {
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('id')
          .eq('user_id', responsibleUser.id)
          .eq('role', 'responsible')
          .maybeSingle();

        if (!existingRole) {
          await supabaseAdmin.from('user_roles').insert({ user_id: responsibleUser.id, role: 'responsible' });
        }

        const { data: existingUc } = await supabaseAdmin
          .from('user_company')
          .select('id')
          .eq('user_id', responsibleUser.id)
          .eq('company_id', companyId)
          .maybeSingle();

        if (!existingUc) {
          await supabaseAdmin.from('user_company').insert({ user_id: responsibleUser.id, company_id: companyId });
        }
      }

      // Employee users
      for (const empCode of authUsers.employees) {
        const empData = employeesByCompany[i].find(e => e.employee_code === empCode);
        if (!empData) continue;

        let empUser = allUsers.users.find(u => u.email === empData.email);

        if (!empUser) {
          const { data: newEmpUser } = await supabaseAdmin.auth.admin.createUser({
            email: empData.email,
            password: 'emp123',
            email_confirm: true,
          });
          empUser = newEmpUser?.user || undefined;
          userCount++;
        }

        if (empUser) {
          const { data: existingRole } = await supabaseAdmin
            .from('user_roles')
            .select('id')
            .eq('user_id', empUser.id)
            .eq('role', 'employee')
            .maybeSingle();

          if (!existingRole) {
            await supabaseAdmin.from('user_roles').insert({ user_id: empUser.id, role: 'employee' });
          }

          // Link user to employee
          await supabaseAdmin
            .from('employees')
            .update({ user_id: empUser.id })
            .eq('employee_code', empCode);

          const { data: existingUc } = await supabaseAdmin
            .from('user_company')
            .select('id')
            .eq('user_id', empUser.id)
            .eq('company_id', companyId)
            .maybeSingle();

          if (!existingUc) {
            await supabaseAdmin.from('user_company').insert({ user_id: empUser.id, company_id: companyId });
          }
        }
      }
    }
    results.users = userCount;

    // Step 4: Create terminals
    console.log('Creating terminals...');
    const terminalIds: string[] = [];

    for (let i = 0; i < terminalsByCompany.length; i++) {
      const companyId = companyIds[i];
      const terminal = terminalsByCompany[i];

      const { data: existing } = await supabaseAdmin
        .from('terminals')
        .select('id')
        .eq('name', terminal.name)
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing) {
        terminalIds.push(existing.id);
      } else {
        const { data: newTerminal, error } = await supabaseAdmin
          .from('terminals')
          .insert({
            name: terminal.name,
            location: terminal.location,
            company_id: companyId,
            status: 'active',
          })
          .select('id')
          .single();

        if (error) throw new Error(`Error creating terminal: ${error.message}`);
        terminalIds.push(newTerminal.id);
      }
    }
    results.terminals = terminalIds.length;

    // Step 5: Generate time events for last 30 days with STRICT entry-exit integrity
    console.log('Generating time events with integrity...');
    let eventCount = 0;
    const now = new Date();

    // First, delete all existing time_events for test employees to ensure clean data
    console.log('Cleaning existing time events for test employees...');
    const testEmployeeIds = Object.values(employeeMap).map(e => e.id);
    
    const { error: deleteError } = await supabaseAdmin
      .from('time_events')
      .delete()
      .in('employee_id', testEmployeeIds);
    
    if (deleteError) {
      console.error('Error deleting existing events:', deleteError);
    } else {
      console.log('Deleted existing time events for test employees');
    }

    // Track previous hash per employee for chain integrity
    const lastHashByEmployee: Record<string, string> = {};

    for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
      const date = new Date(now);
      date.setDate(date.getDate() - dayOffset);
      
      // Skip weekends for some businesses
      const dayOfWeek = date.getDay();
      
      for (let i = 0; i < companyIds.length; i++) {
        const companyId = companyIds[i];
        const terminalId = terminalIds[i];
        const schedule = schedulesByCompany[i];
        const employees = employeesByCompany[i];

        // Skip Sundays for all, Saturdays for dental/physio
        if (dayOfWeek === 0) continue;
        if ((i === 2 || i === 3) && dayOfWeek === 6) continue;

        for (const emp of employees) {
          // Skip inactive employees more often, on_leave sometimes
          if (emp.status === 'inactive') continue;
          if (emp.status === 'on_leave' && Math.random() > 0.2) continue;

          const empInfo = employeeMap[emp.employee_code];
          if (!empInfo) continue;

          // Determine shifts (guarantee complete entry-exit pairs)
          const shifts: Array<{ start: number; end: number }> = [];
          
          if (i === 0) { // Bar: some work morning, some evening (one shift)
            if (Math.random() > 0.5) {
              shifts.push(schedule.morning);
            } else {
              shifts.push(schedule.evening);
            }
          } else if (i === 1) { // Zapatería: split shift (two shifts with gap)
            shifts.push(schedule.morning, schedule.evening);
          } else { // Clínica/Fisio: one shift
            shifts.push(Math.random() > 0.5 ? schedule.morning : schedule.evening);
          }

          for (const shift of shifts) {
            // Calculate entry time with small variance
            const entryTime = new Date(date);
            const entryVariance = Math.floor(Math.random() * 8) - 3; // -3 to +5 minutes
            entryTime.setHours(
              Math.floor(shift.start), 
              Math.floor((shift.start % 1) * 60) + entryVariance, 
              Math.floor(Math.random() * 60), 
              0
            );

            // Calculate exit time with small variance (always after entry)
            const exitTime = new Date(date);
            const exitVariance = Math.floor(Math.random() * 10) - 3; // -3 to +7 minutes
            exitTime.setHours(
              Math.floor(shift.end), 
              Math.floor((shift.end % 1) * 60) + exitVariance, 
              Math.floor(Math.random() * 60), 
              0
            );

            // Skip if entry is in the future
            if (entryTime > now) continue;

            // Ensure exit is always after entry (at least 1 hour shift)
            if (exitTime <= entryTime) {
              exitTime.setTime(entryTime.getTime() + (60 * 60 * 1000)); // Add 1 hour minimum
            }

            const eventSource = Math.random() > 0.7 ? 'qr' : 'pin';

            // === CREATE ENTRY EVENT ===
            const previousHashForEntry = lastHashByEmployee[empInfo.id] || null;
            const entryHash = await computeHash(`${empInfo.id}|entry|${entryTime.toISOString()}`);

            const { error: entryError } = await supabaseAdmin
              .from('time_events')
              .insert({
                employee_id: empInfo.id,
                company_id: companyId,
                terminal_id: terminalId,
                event_type: 'entry',
                event_source: eventSource,
                timestamp: entryTime.toISOString(),
                local_timestamp: entryTime.toISOString(),
                timezone: 'Europe/Madrid',
                event_hash: entryHash,
                previous_hash: previousHashForEntry,
              });

            if (!entryError) {
              eventCount++;
              lastHashByEmployee[empInfo.id] = entryHash;
            }

            // === CREATE EXIT EVENT (only if exit time is in the past) ===
            if (exitTime <= now) {
              const exitHash = await computeHash(`${empInfo.id}|exit|${exitTime.toISOString()}`);

              const { error: exitError } = await supabaseAdmin
                .from('time_events')
                .insert({
                  employee_id: empInfo.id,
                  company_id: companyId,
                  terminal_id: terminalId,
                  event_type: 'exit',
                  event_source: eventSource,
                  timestamp: exitTime.toISOString(),
                  local_timestamp: exitTime.toISOString(),
                  timezone: 'Europe/Madrid',
                  event_hash: exitHash,
                  previous_hash: entryHash, // Chain to entry
                });

              if (!exitError) {
                eventCount++;
                lastHashByEmployee[empInfo.id] = exitHash;
              }
            }
            // If exit is in the future, the entry is left "open" (employee is currently working)
          }
        }
      }
    }
    results.timeEvents = eventCount;

    // Step 6: Create correction requests
    console.log('Creating correction requests...');
    const correctionData = [
      { companyIdx: 0, empCode: 'BAR002', type: 'entry', status: 'pending', reason: 'Olvidé fichar al entrar' },
      { companyIdx: 0, empCode: 'BAR003', type: 'exit', status: 'approved', reason: 'Error en hora de salida' },
      { companyIdx: 1, empCode: 'ZAP002', type: 'exit', status: 'pending', reason: 'Se me olvidó fichar la salida' },
      { companyIdx: 2, empCode: 'DEN003', type: null, status: 'rejected', reason: 'Fichaje duplicado por error del terminal' },
      { companyIdx: 2, empCode: 'DEN001', type: 'entry', status: 'pending', reason: 'Llegué antes de lo registrado' },
      { companyIdx: 3, empCode: 'FIS002', type: 'entry', status: 'approved', reason: 'Fallo en el terminal de fichaje' },
    ];

    let correctionCount = 0;
    for (const corr of correctionData) {
      const empInfo = employeeMap[corr.empCode];
      if (!empInfo) continue;

      const { data: existing } = await supabaseAdmin
        .from('correction_requests')
        .select('id')
        .eq('employee_id', empInfo.id)
        .eq('reason', corr.reason)
        .maybeSingle();

      if (!existing) {
        const requestedTimestamp = new Date();
        requestedTimestamp.setDate(requestedTimestamp.getDate() - Math.floor(Math.random() * 7));
        requestedTimestamp.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

        const { error } = await supabaseAdmin
          .from('correction_requests')
          .insert({
            employee_id: empInfo.id,
            company_id: empInfo.company_id,
            requested_event_type: corr.type,
            requested_timestamp: requestedTimestamp.toISOString(),
            reason: corr.reason,
            status: corr.status,
            review_notes: corr.status !== 'pending' ? (corr.status === 'approved' ? 'Aprobado tras verificar registros' : 'No se pudo verificar la incidencia') : null,
          });

        if (!error) correctionCount++;
      }
    }
    results.corrections = correctionCount;

    // Step 7: Generate employee QR codes
    console.log('Generating QR codes...');
    let qrCount = 0;

    for (const empCode of Object.keys(employeeMap)) {
      const empInfo = employeeMap[empCode];
      
      const { data: existing } = await supabaseAdmin
        .from('employee_qr')
        .select('id')
        .eq('employee_id', empInfo.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!existing) {
        const token = crypto.randomUUID();
        const tokenHash = await computeHash(token);

        const { error } = await supabaseAdmin
          .from('employee_qr')
          .insert({
            employee_id: empInfo.id,
            company_id: empInfo.company_id,
            token_hash: tokenHash,
            version: 1,
            is_active: true,
          });

        if (!error) qrCount++;
      }
    }
    results.qrCodes = qrCount;

    console.log('Test data setup complete!', results);

    return new Response(JSON.stringify({
      success: true,
      message: 'Test data created successfully',
      results,
      credentials: {
        super_admin: { email: 'superadmin@timecontrol.com', password: 'super123', url: '/super-admin' },
        admins: [
          { email: 'admin@elrincon.com', password: 'bar123', company: 'Bar El Rincón' },
          { email: 'admin@zapateria-lopez.com', password: 'zap123', company: 'Zapatería López' },
          { email: 'admin@dentalsonrisas.com', password: 'den123', company: 'Clínica Dental Sonrisas' },
          { email: 'admin@fisio-wellness.com', password: 'fis123', company: 'Fisioterapia Wellness' },
        ],
        responsibles: [
          { email: 'responsable@elrincon.com', password: 'resp123' },
          { email: 'responsable@zapateria-lopez.com', password: 'resp123' },
          { email: 'responsable@dentalsonrisas.com', password: 'resp123' },
          { email: 'responsable@fisio-wellness.com', password: 'resp123' },
        ],
        employees: [
          { email: 'juan.martinez@elrincon.com', password: 'emp123', code: 'BAR001' },
          { email: 'lucia.moreno@zapateria-lopez.com', password: 'emp123', code: 'ZAP001' },
          { email: 'alberto.ruiz@dentalsonrisas.com', password: 'emp123', code: 'DEN001' },
          { email: 'david.molina@fisio-wellness.com', password: 'emp123', code: 'FIS001' },
        ],
        kiosk: {
          url: '/kiosk',
          pins: ['BAR001:1234', 'BAR002:2345', 'ZAP001:1111', 'DEN001:1212', 'FIS001:6666'],
        },
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in setup-test-data:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
