import { cn } from '@/lib/utils';

interface TrafficLightProps {
  status: 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

export function TrafficLight({ status, size = 'md' }: TrafficLightProps) {
  const sizeClasses = {
    sm: 'w-16 h-40',
    md: 'w-20 h-52',
    lg: 'w-28 h-72'
  };

  const lightSizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20'
  };

  return (
    <div className={cn(
      'relative flex flex-col items-center justify-between rounded-2xl bg-muted/50 border-2 border-border p-3',
      sizeClasses[size]
    )}>
      {/* Red light */}
      <div className={cn(
        'rounded-full transition-all duration-500',
        lightSizeClasses[size],
        status === 'red' 
          ? 'bg-red-500 shadow-[0_0_20px_5px_rgba(239,68,68,0.5)]' 
          : 'bg-red-900/30'
      )} />
      
      {/* Yellow light */}
      <div className={cn(
        'rounded-full transition-all duration-500',
        lightSizeClasses[size],
        status === 'yellow' 
          ? 'bg-yellow-500 shadow-[0_0_20px_5px_rgba(234,179,8,0.5)]' 
          : 'bg-yellow-900/30'
      )} />
      
      {/* Green light */}
      <div className={cn(
        'rounded-full transition-all duration-500',
        lightSizeClasses[size],
        status === 'green' 
          ? 'bg-green-500 shadow-[0_0_20px_5px_rgba(34,197,94,0.5)]' 
          : 'bg-green-900/30'
      )} />
    </div>
  );
}
