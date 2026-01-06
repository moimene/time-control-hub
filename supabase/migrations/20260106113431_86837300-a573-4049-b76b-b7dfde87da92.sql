-- Tabla para calendarios laborales
CREATE TABLE public.labor_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  center_id UUID,
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  holidays JSONB NOT NULL DEFAULT '[]',
  shifts_summary JSONB DEFAULT '[]',
  intensive_periods JSONB DEFAULT '[]',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, center_id, year)
);

-- Tabla para paquetes ITSS generados
CREATE TABLE public.itss_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  expedient_number TEXT,
  request_date DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  centers JSONB DEFAULT '[]',
  components JSONB NOT NULL DEFAULT '{}',
  manifest JSONB,
  package_hash TEXT,
  qtsp_evidence_id UUID REFERENCES public.dt_evidences(id),
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_by UUID,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.labor_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itss_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies for labor_calendars
CREATE POLICY "Users can view their company calendars"
  ON public.labor_calendars FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can manage labor calendars"
  ON public.labor_calendars FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Super admins can manage all calendars"
  ON public.labor_calendars FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- RLS policies for itss_packages
CREATE POLICY "Users can view their company ITSS packages"
  ON public.itss_packages FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can manage ITSS packages"
  ON public.itss_packages FOR ALL
  USING (public.is_admin_or_above(auth.uid()) AND public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Super admins can manage all ITSS packages"
  ON public.itss_packages FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_labor_calendars_updated_at
  BEFORE UPDATE ON public.labor_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_itss_packages_updated_at
  BEFORE UPDATE ON public.itss_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();