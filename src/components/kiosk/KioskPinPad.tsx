import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Delete, KeyRound, User, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KioskPinPadProps {
  onSubmit: (employeeCode: string, pin: string) => void;
  onCancel: () => void;
  onValidateCode?: (employeeCode: string) => Promise<{ valid: boolean; name?: string }>;
  isLoading: boolean;
  isValidating?: boolean;
  employeeName?: string;
  nextEventType?: 'entry' | 'exit';
}

export function KioskPinPad({ 
  onSubmit, 
  onCancel, 
  onValidateCode,
  isLoading, 
  isValidating = false,
  employeeName,
  nextEventType
}: KioskPinPadProps) {
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'code' | 'pin'>('code');

  const handleNumberClick = (num: string) => {
    if (step === 'code') {
      if (employeeNumber.length < 3) {
        setEmployeeNumber(prev => prev + num);
      }
    } else {
      if (pin.length < 6) {
        setPin(prev => prev + num);
      }
    }
  };

  const handleDelete = () => {
    if (step === 'code') {
      setEmployeeNumber(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (step === 'code') {
      setEmployeeNumber('');
    } else {
      setPin('');
    }
  };

  const handleNext = async () => {
    if (step === 'code' && employeeNumber.length >= 1) {
      const fullEmployeeCode = 'EMP' + employeeNumber.padStart(3, '0');
      
      if (onValidateCode) {
        const result = await onValidateCode(fullEmployeeCode);
        if (result.valid) {
          setStep('pin');
        }
      } else {
        setStep('pin');
      }
    } else if (step === 'pin' && pin.length >= 4) {
      const fullEmployeeCode = 'EMP' + employeeNumber.padStart(3, '0');
      onSubmit(fullEmployeeCode, pin);
    }
  };

  const handleBack = () => {
    if (step === 'pin') {
      setPin('');
      setStep('code');
    } else {
      onCancel();
    }
  };

  // Display value: show EMP prefix for code step
  const displayValue = step === 'code' 
    ? (employeeNumber ? 'EMP' + employeeNumber.padStart(3, '0') : '') 
    : pin;
  const currentValue = step === 'code' ? employeeNumber : pin;
  const minLength = step === 'code' ? 1 : 4;

  // Theme colors based on step
  const isCodeStep = step === 'code';
  const bgGradient = isCodeStep 
    ? 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20' 
    : 'from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20';
  const iconBg = isCodeStep 
    ? 'bg-blue-100 dark:bg-blue-900/50' 
    : 'bg-green-100 dark:bg-green-900/50';
  const iconColor = isCodeStep 
    ? 'text-blue-600 dark:text-blue-400' 
    : 'text-green-600 dark:text-green-400';
  const buttonAccent = isCodeStep 
    ? 'hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-900/30' 
    : 'hover:border-green-300 hover:bg-green-50 dark:hover:border-green-700 dark:hover:bg-green-900/30';
  const submitButtonBg = isCodeStep
    ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
    : 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700';

  return (
    <div className={cn(
      "min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300",
      `bg-gradient-to-br ${bgGradient}`
    )}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-4"
            onClick={handleBack}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className={cn(
            "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300",
            iconBg
          )}>
            {isCodeStep ? (
              <User className={cn("h-8 w-8", iconColor)} />
            ) : (
              <KeyRound className={cn("h-8 w-8", iconColor)} />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isCodeStep ? (
              'Nº de Empleado'
            ) : (
              <>Hola {employeeName || 'Empleado'} 👋</>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            {isCodeStep 
              ? 'Teclea tu número (ej: 1, 2, 3...)' 
              : 'Introduce tu PIN de 4 dígitos'}
          </p>
          {!isCodeStep && nextEventType && (
            <div className={cn(
              "mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
              nextEventType === 'entry' 
                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                : "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
            )}>
              {nextEventType === 'entry' ? (
                <>
                  <LogIn className="h-4 w-4" />
                  Vas a fichar ENTRADA
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  Vas a fichar SALIDA
                </>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display */}
          <div className="relative">
            <Input
              type={step === 'pin' ? 'password' : 'text'}
              value={displayValue}
              readOnly
              className={cn(
                "text-center text-3xl font-mono h-16 tracking-widest transition-colors duration-300",
                isCodeStep 
                  ? 'focus-visible:ring-blue-500' 
                  : 'focus-visible:ring-green-500'
              )}
              placeholder={isCodeStep ? 'EMP00_' : '••••'}
            />
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <Button
                key={num}
                variant="outline"
                size="lg"
                className={cn("h-16 text-2xl font-semibold transition-colors", buttonAccent)}
                onClick={() => handleNumberClick(num.toString())}
                disabled={isLoading || isValidating}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              className={cn("h-16 text-lg transition-colors", buttonAccent)}
              onClick={handleClear}
              disabled={isLoading || isValidating}
            >
              Borrar
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={cn("h-16 text-2xl font-semibold transition-colors", buttonAccent)}
              onClick={() => handleNumberClick('0')}
              disabled={isLoading || isValidating}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={cn("h-16 transition-colors", buttonAccent)}
              onClick={handleDelete}
              disabled={isLoading || isValidating}
            >
              <Delete className="h-6 w-6" />
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            className={cn("w-full h-14 text-lg text-white transition-colors", submitButtonBg)}
            onClick={handleNext}
            disabled={isLoading || isValidating || currentValue.length < minLength}
          >
            {isLoading || isValidating 
              ? 'Procesando...' 
              : isCodeStep ? 'Siguiente' : 'Fichar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
