import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegrityBadgeProps {
  hash: string;
  verified?: boolean;
  qtspToken?: string;
  className?: string;
}

export function IntegrityBadge({ 
  hash, 
  verified = true, 
  qtspToken,
  className 
}: IntegrityBadgeProps) {
  const truncatedHash = hash ? `${hash.substring(0, 8)}...${hash.substring(hash.length - 4)}` : 'N/A';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={verified ? 'default' : 'secondary'}
          className={cn(
            'font-mono text-xs cursor-help',
            verified ? 'bg-green-100 text-green-800 hover:bg-green-200' : '',
            className
          )}
        >
          {verified ? (
            <ShieldCheck className="h-3 w-3 mr-1" />
          ) : qtspToken ? (
            <Shield className="h-3 w-3 mr-1" />
          ) : (
            <ShieldAlert className="h-3 w-3 mr-1" />
          )}
          {truncatedHash}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-xs">Hash SHA-256</p>
          <code className="text-xs break-all block">{hash || 'No disponible'}</code>
          {qtspToken && (
            <>
              <p className="font-medium text-xs mt-2">Token QTSP</p>
              <code className="text-xs break-all block">{qtspToken}</code>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
