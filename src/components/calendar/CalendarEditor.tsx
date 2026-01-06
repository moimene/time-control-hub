import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Holiday {
  date: string;
  type: 'nacional' | 'autonomico' | 'local';
  description: string;
}

interface IntensivePeriod {
  start_date: string;
  end_date: string;
  hours_day: number;
}

interface ShiftSummary {
  name: string;
  start: string;
  end: string;
}

interface CalendarEditorProps {
  year: number;
  holidays: Holiday[];
  intensivePeriods: IntensivePeriod[];
  shiftsSummary: ShiftSummary[];
  onHolidaysChange: (holidays: Holiday[]) => void;
  onIntensivePeriodsChange: (periods: IntensivePeriod[]) => void;
  onShiftsSummaryChange: (shifts: ShiftSummary[]) => void;
}

export function CalendarEditor({
  year,
  holidays,
  intensivePeriods,
  shiftsSummary,
  onHolidaysChange,
  onIntensivePeriodsChange,
  onShiftsSummaryChange
}: CalendarEditorProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [holidayType, setHolidayType] = useState<'nacional' | 'autonomico' | 'local'>('nacional');
  const [holidayDescription, setHolidayDescription] = useState('');
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);

  const holidayDates = holidays.map(h => new Date(h.date));

  const handleAddHoliday = () => {
    if (!selectedDate || !holidayDescription) return;

    const newHoliday: Holiday = {
      date: format(selectedDate, 'yyyy-MM-dd'),
      type: holidayType,
      description: holidayDescription
    };

    onHolidaysChange([...holidays, newHoliday]);
    setSelectedDate(undefined);
    setHolidayDescription('');
    setIsAddHolidayOpen(false);
  };

  const handleRemoveHoliday = (date: string) => {
    onHolidaysChange(holidays.filter(h => h.date !== date));
  };

  const getHolidayTypeColor = (type: string) => {
    switch (type) {
      case 'nacional':
        return 'bg-red-100 text-red-800';
      case 'autonomico':
        return 'bg-orange-100 text-orange-800';
      case 'local':
        return 'bg-blue-100 text-blue-800';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar View */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <Calendar
            mode="multiple"
            selected={holidayDates}
            month={new Date(year, 0)}
            locale={es}
            className="rounded-md border"
            modifiers={{
              holiday: holidayDates
            }}
            modifiersClassNames={{
              holiday: 'bg-red-100 text-red-900 font-medium'
            }}
          />
        </div>

        {/* Holidays List */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Festivos {year}</h3>
            <Dialog open={isAddHolidayOpen} onOpenChange={setIsAddHolidayOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Añadir Festivo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={es}
                      className="rounded-md border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={holidayType} onValueChange={(v: any) => setHolidayType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nacional">Nacional</SelectItem>
                        <SelectItem value="autonomico">Autonómico</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      value={holidayDescription}
                      onChange={(e) => setHolidayDescription(e.target.value)}
                      placeholder="Ej: Día de la Constitución"
                    />
                  </div>
                  <Button onClick={handleAddHoliday} className="w-full">
                    Añadir Festivo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {holidays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay festivos configurados
              </p>
            ) : (
              holidays
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((holiday) => (
                  <div
                    key={holiday.date}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(holiday.date), 'dd MMM', { locale: es })}
                      </span>
                      <Badge className={getHolidayTypeColor(holiday.type)}>
                        {holiday.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground truncate max-w-32">
                        {holiday.description}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveHoliday(holiday.date)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Legend */}
          <div className="flex gap-4 pt-4 border-t">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-100" />
              <span className="text-xs">Nacional</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-100" />
              <span className="text-xs">Autonómico</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-100" />
              <span className="text-xs">Local</span>
            </div>
          </div>
        </div>
      </div>

      {/* Intensive Periods */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Jornada Intensiva</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onIntensivePeriodsChange([
              ...intensivePeriods,
              { start_date: '', end_date: '', hours_day: 7 }
            ])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Añadir período
          </Button>
        </div>
        
        {intensivePeriods.map((period, index) => (
          <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Input
              type="date"
              value={period.start_date}
              onChange={(e) => {
                const updated = [...intensivePeriods];
                updated[index].start_date = e.target.value;
                onIntensivePeriodsChange(updated);
              }}
              className="w-36"
            />
            <span className="text-muted-foreground">a</span>
            <Input
              type="date"
              value={period.end_date}
              onChange={(e) => {
                const updated = [...intensivePeriods];
                updated[index].end_date = e.target.value;
                onIntensivePeriodsChange(updated);
              }}
              className="w-36"
            />
            <Input
              type="number"
              value={period.hours_day}
              onChange={(e) => {
                const updated = [...intensivePeriods];
                updated[index].hours_day = parseInt(e.target.value) || 7;
                onIntensivePeriodsChange(updated);
              }}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">h/día</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onIntensivePeriodsChange(intensivePeriods.filter((_, i) => i !== index));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Shifts Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Turnos / Horarios Tipo</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onShiftsSummaryChange([
              ...shiftsSummary,
              { name: '', start: '09:00', end: '18:00' }
            ])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Añadir turno
          </Button>
        </div>
        
        {shiftsSummary.map((shift, index) => (
          <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Input
              placeholder="Nombre del turno"
              value={shift.name}
              onChange={(e) => {
                const updated = [...shiftsSummary];
                updated[index].name = e.target.value;
                onShiftsSummaryChange(updated);
              }}
              className="flex-1"
            />
            <Input
              type="time"
              value={shift.start}
              onChange={(e) => {
                const updated = [...shiftsSummary];
                updated[index].start = e.target.value;
                onShiftsSummaryChange(updated);
              }}
              className="w-28"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="time"
              value={shift.end}
              onChange={(e) => {
                const updated = [...shiftsSummary];
                updated[index].end = e.target.value;
                onShiftsSummaryChange(updated);
              }}
              className="w-28"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                onShiftsSummaryChange(shiftsSummary.filter((_, i) => i !== index));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
