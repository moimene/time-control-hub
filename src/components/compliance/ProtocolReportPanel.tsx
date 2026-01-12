import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Copy, 
  Check, 
  FileJson, 
  BarChart3, 
  Clock,
  Building2,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProtocolReportPanelProps {
  report: Record<string, any> | null;
  loading: boolean;
}

export function ProtocolReportPanel({ report, loading }: ProtocolReportPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!report && !loading) return null;

  const copyToClipboard = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      toast.success('Report copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy report');
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  };

  const getStatusBadge = (status: string | boolean | number) => {
    if (typeof status === 'boolean') {
      return status ? (
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Yes</Badge>
      ) : (
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">No</Badge>
      );
    }
    if (typeof status === 'number') {
      return <Badge variant="secondary">{status}</Badge>;
    }
    const lowerStatus = String(status).toLowerCase();
    if (['passed', 'success', 'ok', 'true'].includes(lowerStatus)) {
      return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">{status}</Badge>;
    }
    if (['pending', 'warning', 'waiting'].includes(lowerStatus)) {
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">{status}</Badge>;
    }
    if (['failed', 'error', 'false'].includes(lowerStatus)) {
      return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">{status}</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const renderValue = (value: any, depth = 0): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">N/A</span>;
    }
    if (typeof value === 'boolean') {
      return getStatusBadge(value);
    }
    if (typeof value === 'number') {
      return <span className="font-mono text-primary">{value.toLocaleString()}</span>;
    }
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
        return <span className="text-muted-foreground">{formatTimestamp(value)}</span>;
      }
      return <span>{value}</span>;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-muted-foreground italic">Empty array</span>;
      }
      return (
        <div className="space-y-1 ml-2">
          {value.slice(0, 5).map((item, i) => (
            <div key={i} className="text-sm">
              {renderValue(item, depth + 1)}
            </div>
          ))}
          {value.length > 5 && (
            <span className="text-xs text-muted-foreground">...and {value.length - 5} more</span>
          )}
        </div>
      );
    }
    if (typeof value === 'object') {
      return (
        <div className={cn("space-y-2", depth > 0 && "ml-3 pl-3 border-l border-border/50")}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} className="text-sm">
              <span className="font-mono text-muted-foreground">{k}: </span>
              {renderValue(v, depth + 1)}
            </div>
          ))}
        </div>
      );
    }
    return <span>{String(value)}</span>;
  };

  const moduleGroups = [
    { key: '1-5_labor_limits', label: 'Modules 1-5: Labor Limits' },
    { key: '6_night_work', label: 'Module 6: Night Work' },
    { key: '7_part_time', label: 'Module 7: Part Time' },
    { key: '8_vacations', label: 'Module 8: Vacations' },
    { key: '9_absences', label: 'Module 9: Absences' },
    { key: '10_coverage', label: 'Module 10: Coverage' },
    { key: '11_templates', label: 'Module 11: Templates' },
    { key: '12_integrity_qtsp', label: 'Module 12: Integrity/QTSP' },
    { key: '13_data_protection', label: 'Module 13: Data Protection' },
    { key: '14_certified_comms', label: 'Module 14: Certified Comms' },
    { key: '15_reporting', label: 'Module 15: ITSS Reporting' },
  ];

  return (
    <Card className="backdrop-blur-md bg-card/50 border-border/50 shadow-xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Protocol Verification Report
          </CardTitle>
          <CardDescription className="flex items-center gap-4 text-xs">
            {report?.company_id && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {report.company_id.slice(0, 8)}...
              </span>
            )}
            {report?.test_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {report.test_date}
              </span>
            )}
            {report?.executed_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimestamp(report.executed_at)}
              </span>
            )}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          disabled={!report}
        >
          {copied ? (
            <Check className="h-4 w-4 mr-1 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4 mr-1" />
          )}
          {copied ? 'Copied!' : 'Copy JSON'}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <Tabs defaultValue="formatted" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="formatted" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Formatted View
              </TabsTrigger>
              <TabsTrigger value="raw" className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                Raw JSON
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="formatted">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {/* Summary Section */}
                  {report?.summary && (
                    <div className="p-4 rounded-lg bg-background/50 border border-border/50">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Summary
                      </h4>
                      {renderValue(report.summary)}
                    </div>
                  )}
                  
                  {/* Module Groups */}
                  {moduleGroups.map(group => {
                    const moduleData = report?.modules?.[group.key] || report?.[group.key];
                    if (!moduleData) return null;
                    
                    return (
                      <div 
                        key={group.key} 
                        className="p-4 rounded-lg bg-background/30 border border-border/30"
                      >
                        <h4 className="font-semibold mb-3 text-sm">{group.label}</h4>
                        {renderValue(moduleData)}
                      </div>
                    );
                  })}
                  
                  {/* Additional Data */}
                  {Object.entries(report || {})
                    .filter(([key]) => !['company_id', 'test_date', 'executed_at', 'summary', 'modules', ...moduleGroups.map(g => g.key)].includes(key))
                    .map(([key, value]) => (
                      <div 
                        key={key} 
                        className="p-4 rounded-lg bg-background/30 border border-border/30"
                      >
                        <h4 className="font-semibold mb-3 text-sm capitalize">
                          {key.replace(/_/g, ' ')}
                        </h4>
                        {renderValue(value)}
                      </div>
                    ))
                  }
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="raw">
              <ScrollArea className="h-[500px]">
                <pre className="p-4 rounded-lg bg-background/50 border border-border/50 text-xs font-mono overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
