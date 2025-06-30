
import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MobileNavigationProps {
  onCTAClick: () => void;
  scrollToSection: (sectionId: string) => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ onCTAClick, scrollToSection }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleSectionClick = (sectionId: string) => {
    scrollToSection(sectionId);
    setIsOpen(false);
  };

  const handleCTAClick = () => {
    onCTAClick();
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden p-2">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-left">
            <img src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" alt="Sewdle Logo" className="h-6 w-auto" />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col space-y-6 mt-8">
          <button 
            onClick={() => handleSectionClick('como-funciona')} 
            className="text-left text-gray-600 hover:text-orange-600 transition-colors font-medium py-2"
          >
            {t('nav.howItWorks')}
          </button>
          <button 
            onClick={() => handleSectionClick('casos-de-uso')} 
            className="text-left text-gray-600 hover:text-orange-600 transition-colors font-medium py-2"
          >
            {t('nav.useCases')}
          </button>
          <button 
            onClick={() => handleSectionClick('integraciones')} 
            className="text-left text-gray-600 hover:text-orange-600 transition-colors font-medium py-2"
          >
            {t('nav.integrations')}
          </button>
          
          <div className="border-t pt-6 space-y-4">
            <Button 
              onClick={handleCTAClick} 
              variant="ghost" 
              className="w-full justify-start text-gray-600 hover:text-orange-600 font-medium"
            >
              {t('nav.login')}
            </Button>
            <Button 
              onClick={handleCTAClick} 
              className="w-full bg-gradient-to-r from-[#FF5C02] to-orange-600 text-white font-medium rounded-full hover:shadow-lg transition-all duration-300"
            >
              {t('nav.signup')}
            </Button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNavigation;
