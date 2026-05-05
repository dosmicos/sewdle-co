import React from 'react';

interface MetricSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const MetricSection: React.FC<MetricSectionProps> = ({ title, icon, children }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
};

export default MetricSection;
