import React from 'react';
import { Progress } from '@/components/ui/progress';
import { getPasswordStrength, getPasswordStrengthLabel, getPasswordStrengthColor } from '@/lib/passwordValidation';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ 
  password, 
  className 
}) => {
  const strength = getPasswordStrength(password);
  const label = getPasswordStrengthLabel(strength);
  const colorClass = getPasswordStrengthColor(strength);

  if (!password) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Fortaleza de la contraseña:</span>
        <span className={cn("text-sm font-medium", colorClass)}>{label}</span>
      </div>
      <Progress 
        value={strength} 
        className={cn(
          "h-2",
          "[&>div]:transition-all [&>div]:duration-300",
          strength < 30 && "[&>div]:bg-destructive",
          strength >= 30 && strength < 50 && "[&>div]:bg-orange-500",
          strength >= 50 && strength < 70 && "[&>div]:bg-yellow-500",
          strength >= 70 && strength < 90 && "[&>div]:bg-blue-500",
          strength >= 90 && "[&>div]:bg-green-500"
        )}
      />
    </div>
  );
};