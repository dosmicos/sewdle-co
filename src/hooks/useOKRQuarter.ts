import { useState, useEffect } from 'react';
import { addQuarters, startOfQuarter, endOfQuarter, format, subQuarters } from 'date-fns';
import { es } from 'date-fns/locale';

export interface Quarter {
  id: string;
  year: number;
  quarter: number;
  label: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isActive: boolean;
}

export const useOKRQuarter = () => {
  const [currentQuarter, setCurrentQuarter] = useState<Quarter | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter | null>(null);
  const [availableQuarters, setAvailableQuarters] = useState<Quarter[]>([]);

  const generateQuarter = (date: Date): Quarter => {
    const startDate = startOfQuarter(date);
    const endDate = endOfQuarter(date);
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const now = new Date();
    
    return {
      id: `${year}-Q${quarter}`,
      year,
      quarter,
      label: `Q${quarter} ${year}`,
      startDate,
      endDate,
      isCurrent: startDate <= now && now <= endDate,
      isActive: endDate >= now // Quarter is current or future
    };
  };

  const generateAvailableQuarters = () => {
    const quarters: Quarter[] = [];
    const now = new Date();
    
    // Generate 2 past quarters, current quarter, and 2 future quarters
    for (let i = -2; i <= 2; i++) {
      const quarterDate = addQuarters(now, i);
      quarters.push(generateQuarter(quarterDate));
    }
    
    return quarters.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  };

  const navigateToQuarter = (direction: 'prev' | 'next') => {
    if (!selectedQuarter) return;

    const currentIndex = availableQuarters.findIndex(q => q.id === selectedQuarter.id);
    if (currentIndex === -1) return;

    if (direction === 'prev' && currentIndex < availableQuarters.length - 1) {
      setSelectedQuarter(availableQuarters[currentIndex + 1]);
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedQuarter(availableQuarters[currentIndex - 1]);
    }
  };

  const selectQuarter = (quarterId: string) => {
    const quarter = availableQuarters.find(q => q.id === quarterId);
    if (quarter) {
      setSelectedQuarter(quarter);
    }
  };

  const goToCurrentQuarter = () => {
    if (currentQuarter) {
      setSelectedQuarter(currentQuarter);
    }
  };

  const formatQuarterRange = (quarter: Quarter) => {
    return `${format(quarter.startDate, 'MMM', { locale: es })} - ${format(quarter.endDate, 'MMM yyyy', { locale: es })}`;
  };

  const getQuarterProgress = (quarter: Quarter) => {
    const now = new Date();
    if (now < quarter.startDate) return 0;
    if (now > quarter.endDate) return 100;
    
    const totalDays = Math.ceil((quarter.endDate.getTime() - quarter.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now.getTime() - quarter.startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.round((elapsedDays / totalDays) * 100);
  };

  const getDaysRemaining = (quarter: Quarter) => {
    const now = new Date();
    if (now > quarter.endDate) return 0;
    if (now < quarter.startDate) return Math.ceil((quarter.endDate.getTime() - quarter.startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.ceil((quarter.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isQuarterClosed = (quarter: Quarter) => {
    return new Date() > quarter.endDate;
  };

  const canEditObjectives = (quarter: Quarter) => {
    // Allow editing if quarter is current or future
    return quarter.isActive;
  };

  useEffect(() => {
    const quarters = generateAvailableQuarters();
    setAvailableQuarters(quarters);
    
    const current = quarters.find(q => q.isCurrent);
    if (current) {
      setCurrentQuarter(current);
      setSelectedQuarter(current);
    }
  }, []);

  return {
    currentQuarter,
    selectedQuarter,
    availableQuarters,
    navigateToQuarter,
    selectQuarter,
    goToCurrentQuarter,
    formatQuarterRange,
    getQuarterProgress,
    getDaysRemaining,
    isQuarterClosed,
    canEditObjectives
  };
};