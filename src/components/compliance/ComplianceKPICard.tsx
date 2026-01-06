import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ComplianceKPICardProps {
  title: string;
  value: number | string;
  description: string;
  icon: ReactNode;
  status: 'green' | 'yellow' | 'red';
  loading?: boolean;
}

export function ComplianceKPICard({ 
  title, 
  value, 
  description, 
  icon, 
  status, 
  loading 
}: ComplianceKPICardProps) {
  const statusColors = {
    green: 'border-l-green-500',
    yellow: 'border-l-yellow-500',
    red: 'border-l-red-500'
  };

  const iconColors = {
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500'
  };

  return (
    <Card className={cn('border-l-4', statusColors[status])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn(iconColors[status])}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
