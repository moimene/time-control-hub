import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QTSPAuditLog {
  id: string;
  action: string;
  status: string;
  error_message: string | null;
  response_payload: Record<string, unknown> | null;
  created_at: string;
}

// Error category for categorization
type ErrorCategory = 'DNS_ERROR' | 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'CONNECTION_REFUSED' | 'SSL_ERROR' | 'UNKNOWN';

const categorizeError = (message: string): { category: ErrorCategory; label: string } => {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('dns') || lowerMessage.includes('name or service not known') || lowerMessage.includes('lookup')) {
    return { category: 'DNS_ERROR', label: 'Error DNS' };
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('no respondió')) {
    return { category: 'TIMEOUT', label: 'Timeout' };
  }
  if (lowerMessage.includes('connection refused') || lowerMessage.includes('connect failed')) {
    return { category: 'CONNECTION_REFUSED', label: 'Conexión rechazada' };
  }
  if (lowerMessage.includes('ssl') || lowerMessage.includes('certificate') || lowerMessage.includes('tls')) {
    return { category: 'SSL_ERROR', label: 'Error SSL' };
  }
  if (/http\s*4\d{2}|status:\s*4\d{2}|error\s*4\d{2}/i.test(message)) {
    return { category: 'HTTP_4XX', label: 'Error cliente (4xx)' };
  }
  if (/http\s*5\d{2}|status:\s*5\d{2}|error\s*5\d{2}/i.test(message)) {
    return { category: 'HTTP_5XX', label: 'Error servidor (5xx)' };
  }
  
  return { category: 'UNKNOWN', label: 'Error desconocido' };
};

export function useQTSPRealtimeAlerts(enabled: boolean = true) {
  const handleNewError = useCallback((payload: { new: QTSPAuditLog }) => {
    const log = payload.new;
    
    // Only show critical errors (not health checks or successful operations)
    if (log.status !== 'error') return;
    
    // Skip state tracking entries
    if (log.action.startsWith('state_')) return;
    
    // Get error details
    const responsePayload = log.response_payload as { message?: string; health_status?: string; consecutive_failures?: number } | null;
    const errorMessage = log.error_message || responsePayload?.message || 'Error desconocido';
    const consecutiveFailures = responsePayload?.consecutive_failures || 0;
    
    const { label } = categorizeError(errorMessage);
    
    // Show toast notification
    toast.error(`🚨 Error QTSP: ${label}`, {
      description: errorMessage.substring(0, 100),
      duration: 15000,
      action: consecutiveFailures >= 5 ? {
        label: 'Ver detalles',
        onClick: () => {
          // This would trigger opening the modal - handled by the component
          window.dispatchEvent(new CustomEvent('qtsp-error-detail', { detail: log }));
        },
      } : undefined,
    });
    
    // Browser notification for critical errors
    if (consecutiveFailures >= 10 || log.action.includes('notarize')) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 Error Crítico QTSP', {
          body: `${label}: ${errorMessage.substring(0, 100)}`,
          icon: '/favicon.ico',
          tag: 'qtsp-critical-error',
        });
      }
    }
  }, []);
  
  useEffect(() => {
    if (!enabled) return;
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Subscribe to realtime updates on qtsp_audit_log
    const channel = supabase
      .channel('qtsp-realtime-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'qtsp_audit_log',
          filter: 'status=eq.error',
        },
        handleNewError
      )
      .subscribe();
    
    console.log('[QTSP Realtime] Subscribed to error alerts');
    
    return () => {
      console.log('[QTSP Realtime] Unsubscribed from error alerts');
      supabase.removeChannel(channel);
    };
  }, [enabled, handleNewError]);
}
