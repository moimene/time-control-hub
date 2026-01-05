import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Delete, KeyRound } from 'lucide-react';

interface KioskPinPadProps {
  onSubmit: (employeeCode: string, pin: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function KioskPinPad({ onSubmit, onCancel, isLoading }: KioskPinPadProps) {
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

  const handleNext = () => {
    if (step === 'code' && employeeNumber.length >= 1) {
      setStep('pin');
    } else if (step === 'pin' && pin.length >= 4) {
      // Build full employee code: EMP + padded number (e.g., 1 -> EMP001)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-4"
            onClick={handleBack}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {step === 'code' ? 'Nº de Empleado' : 'Introduce tu PIN'}
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            {step === 'code' ? 'Teclea tu número (ej: 1, 2, 3...)' : 'Teclea tu PIN de 4 dígitos'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display */}
          <div className="relative">
            <Input
              type={step === 'pin' ? 'password' : 'text'}
              value={displayValue}
              readOnly
              className="text-center text-3xl font-mono h-16 tracking-widest"
              placeholder={step === 'code' ? 'EMP00_' : '••••'}
            />
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <Button
                key={num}
                variant="outline"
                size="lg"
                className="h-16 text-2xl font-semibold"
                onClick={() => handleNumberClick(num.toString())}
                disabled={isLoading}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-lg"
              onClick={handleClear}
              disabled={isLoading}
            >
              Borrar
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-2xl font-semibold"
              onClick={() => handleNumberClick('0')}
              disabled={isLoading}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16"
              onClick={handleDelete}
              disabled={isLoading}
            >
              <Delete className="h-6 w-6" />
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            className="w-full h-14 text-lg"
            onClick={handleNext}
            disabled={isLoading || currentValue.length < minLength}
          >
            {isLoading ? 'Procesando...' : step === 'code' ? 'Siguiente' : 'Fichar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
