-- =====================================================
-- MIGRACIÓN PARTE 1: Añadir rol asesor al enum
-- (El enum debe comitearse antes de usarse en funciones)
-- =====================================================

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'asesor';