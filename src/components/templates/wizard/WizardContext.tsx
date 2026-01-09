import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { TemplatePayload, SEED_TEMPLATES, DEFAULT_TEMPLATE_PAYLOAD } from '@/types/templates';

const STORAGE_KEY = 'template-wizard-draft';

export interface WizardState {
  currentStep: number;
  totalSteps: number;
  payload: TemplatePayload;
  selectedSeedSector: string | null;
  territorialScope: 'estatal' | 'autonomico' | 'provincial' | 'empresa';
  region: string;
  validationErrors: string[];
  isSimulationComplete: boolean;
  simulationResult: any | null;
}

interface WizardContextType {
  state: WizardState;
  lastSavedAt: Date | null;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updatePayload: (updates: Partial<TemplatePayload>) => void;
  updateNestedPayload: <K extends keyof TemplatePayload>(
    section: K,
    updates: Partial<NonNullable<TemplatePayload[K]>>
  ) => void;
  selectSeed: (sector: string) => void;
  setTerritorialScope: (scope: WizardState['territorialScope']) => void;
  setRegion: (region: string) => void;
  validateCurrentStep: () => boolean;
  setSimulationResult: (result: any) => void;
  resetWizard: () => void;
  clearDraft: () => void;
  saveCurrentStep: () => void;
  isStepSaved: (step: number) => boolean;
  hasDraft: boolean;
  canProceed: boolean;
}

const WizardContext = createContext<WizardContextType | null>(null);

const TOTAL_STEPS = 12;

const initialState: WizardState = {
  currentStep: 1,
  totalSteps: TOTAL_STEPS,
  payload: { ...DEFAULT_TEMPLATE_PAYLOAD },
  selectedSeedSector: null,
  territorialScope: 'estatal',
  region: '',
  validationErrors: [],
  isSimulationComplete: false,
  simulationResult: null,
};

// Hard-stop validations per step
const HARD_STOPS = {
  limits: {
    min_daily_rest: 12,
    min_weekly_rest: 36,
  },
  breaks: {
    min_break_minutes: 15,
  },
  overtime: {
    max_yearly: 80,
  },
};

function loadDraft(): WizardState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Verify it's a valid state object
      if (parsed && typeof parsed.currentStep === 'number' && parsed.payload) {
        return { ...initialState, ...parsed, validationErrors: [] };
      }
    }
  } catch (e) {
    console.warn('Failed to load wizard draft:', e);
  }
  return null;
}

function saveDraft(state: WizardState) {
  try {
    // Don't save validation errors or simulation results
    const toSave = {
      currentStep: state.currentStep,
      payload: state.payload,
      selectedSeedSector: state.selectedSeedSector,
      territorialScope: state.territorialScope,
      region: state.region,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to save wizard draft:', e);
  }
}

function clearDraftStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear wizard draft:', e);
  }
}

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(() => loadDraft() || initialState);
  const [hasDraft] = useState(() => loadDraft() !== null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Autosave on state changes (debounced effect)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(state);
      setLastSavedAt(new Date());
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setState(prev => ({ ...prev, currentStep: step, validationErrors: [] }));
    }
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep < TOTAL_STEPS) {
        return { ...prev, currentStep: prev.currentStep + 1, validationErrors: [] };
      }
      return prev;
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep > 1) {
        return { ...prev, currentStep: prev.currentStep - 1, validationErrors: [] };
      }
      return prev;
    });
  }, []);

  const updatePayload = useCallback((updates: Partial<TemplatePayload>) => {
    setState(prev => ({
      ...prev,
      payload: { ...prev.payload, ...updates },
    }));
  }, []);

  const updateNestedPayload = useCallback(<K extends keyof TemplatePayload>(
    section: K,
    updates: Partial<NonNullable<TemplatePayload[K]>>
  ) => {
    setState(prev => ({
      ...prev,
      payload: {
        ...prev.payload,
        [section]: {
          ...(prev.payload[section] || {}),
          ...updates,
        },
      },
    }));
  }, []);

  const selectSeed = useCallback((sector: string) => {
    const seedTemplate = SEED_TEMPLATES.find(t => t.sector === sector);
    if (seedTemplate) {
      setState(prev => ({
        ...prev,
        selectedSeedSector: sector,
        payload: { ...seedTemplate.payload },
      }));
    }
  }, []);

  const setTerritorialScope = useCallback((scope: WizardState['territorialScope']) => {
    setState(prev => ({ ...prev, territorialScope: scope }));
  }, []);

  const setRegion = useCallback((region: string) => {
    setState(prev => ({ ...prev, region }));
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    const errors: string[] = [];
    const { payload, currentStep } = state;

    // Step 3: Working hours validation
    if (currentStep === 3) {
      const workingTime = payload.working_time || {};
      const limits = payload.limits || {};
      
      if ((workingTime.rest_daily_hours_min || limits.min_daily_rest || 0) < HARD_STOPS.limits.min_daily_rest) {
        errors.push(`El descanso diario mínimo debe ser ≥ ${HARD_STOPS.limits.min_daily_rest} horas (requisito legal)`);
      }
      if ((workingTime.rest_weekly_hours_min || limits.min_weekly_rest || 0) < HARD_STOPS.limits.min_weekly_rest) {
        errors.push(`El descanso semanal mínimo debe ser ≥ ${HARD_STOPS.limits.min_weekly_rest} horas (requisito legal)`);
      }
    }

    // Step 4: Breaks validation
    if (currentStep === 4) {
      const breaks = payload.breaks || {};
      if ((breaks.break_duration_minutes_min || breaks.min_break_minutes || 0) < HARD_STOPS.breaks.min_break_minutes) {
        errors.push(`La pausa mínima debe ser ≥ ${HARD_STOPS.breaks.min_break_minutes} minutos cuando la jornada > 6h`);
      }
    }

    // Step 5: Overtime validation
    if (currentStep === 5) {
      const overtime = payload.overtime || {};
      if ((overtime.overtime_yearly_cap || 0) > HARD_STOPS.overtime.max_yearly) {
        errors.push(`El tope de horas extra no puede superar ${HARD_STOPS.overtime.max_yearly} h/año (base legal)`);
      }
    }

    setState(prev => ({ ...prev, validationErrors: errors }));
    return errors.length === 0;
  }, [state]);

  const setSimulationResult = useCallback((result: any) => {
    setState(prev => ({
      ...prev,
      simulationResult: result,
      isSimulationComplete: true,
    }));
  }, []);

  const resetWizard = useCallback(() => {
    clearDraftStorage();
    setState(initialState);
  }, []);

  const clearDraft = useCallback(() => {
    clearDraftStorage();
  }, []);

  const [savedSteps, setSavedSteps] = useState<Set<number>>(new Set());

  const saveCurrentStep = useCallback(() => {
    // Mark current step as explicitly saved
    setSavedSteps(prev => new Set([...prev, state.currentStep]));
    // Force save to localStorage
    saveDraft(state);
    setLastSavedAt(new Date());
  }, [state]);

  const isStepSaved = useCallback((step: number) => {
    return savedSteps.has(step);
  }, [savedSteps]);

  const canProceed = state.validationErrors.length === 0;

  return (
    <WizardContext.Provider
      value={{
        state,
        lastSavedAt,
        goToStep,
        nextStep,
        prevStep,
        updatePayload,
        updateNestedPayload,
        selectSeed,
        setTerritorialScope,
        setRegion,
        validateCurrentStep,
        setSimulationResult,
        resetWizard,
        clearDraft,
        saveCurrentStep,
        isStepSaved,
        hasDraft,
        canProceed,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
