import { useMemo } from 'react';

interface TimeEvent {
  id: string;
  employee_id: string;
  event_type: 'entry' | 'exit';
  timestamp: string;
  employees?: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
}

interface Inconsistency {
  type: 'consecutive_same_type' | 'orphan_entry';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  eventType: 'entry' | 'exit';
  timestamp: string;
  previousTimestamp?: string;
}

export function useTimeEventInconsistencies(events: TimeEvent[] | undefined) {
  return useMemo(() => {
    if (!events || events.length === 0) {
      return { inconsistencies: [], hasInconsistencies: false, count: 0 };
    }

    const inconsistencies: Inconsistency[] = [];
    
    // Group events by employee
    const eventsByEmployee = events.reduce((acc, event) => {
      if (!acc[event.employee_id]) {
        acc[event.employee_id] = [];
      }
      acc[event.employee_id].push(event);
      return acc;
    }, {} as Record<string, TimeEvent[]>);

    // Check each employee's events for inconsistencies
    Object.entries(eventsByEmployee).forEach(([employeeId, employeeEvents]) => {
      // Sort by timestamp ascending
      const sorted = [...employeeEvents].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const previous = sorted[i - 1];

        // Detect consecutive same type events
        if (current.event_type === previous.event_type) {
          inconsistencies.push({
            type: 'consecutive_same_type',
            employeeId,
            employeeName: `${current.employees?.first_name || ''} ${current.employees?.last_name || ''}`.trim(),
            employeeCode: current.employees?.employee_code || '',
            eventType: current.event_type,
            timestamp: current.timestamp,
            previousTimestamp: previous.timestamp,
          });
        }
      }

      // Check for orphan entries (last event is an entry from more than 12h ago)
      if (sorted.length > 0) {
        const lastEvent = sorted[sorted.length - 1];
        const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
        
        if (
          lastEvent.event_type === 'entry' &&
          new Date(lastEvent.timestamp).getTime() < twelveHoursAgo
        ) {
          inconsistencies.push({
            type: 'orphan_entry',
            employeeId,
            employeeName: `${lastEvent.employees?.first_name || ''} ${lastEvent.employees?.last_name || ''}`.trim(),
            employeeCode: lastEvent.employees?.employee_code || '',
            eventType: 'entry',
            timestamp: lastEvent.timestamp,
          });
        }
      }
    });

    return {
      inconsistencies,
      hasInconsistencies: inconsistencies.length > 0,
      count: inconsistencies.length,
    };
  }, [events]);
}
