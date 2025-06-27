
import React, { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  image_url?: string;
  variants: any[];
}

interface SearchableProductSelectorProps {
  products: Product[];
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
  placeholder?: string;
}

// Helper function to normalize text for better search
const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
};

// Helper function to check if search term matches product
const matchesSearch = (product: Product, searchTerm: string) => {
  if (!searchTerm) return true;
  
  const normalizedSearch = normalizeText(searchTerm);
  const normalizedName = normalizeText(product.name);
  const normalizedDescription = normalizeText(product.description || '');
  
  // Check if search term matches any word in name or description
  const searchWords = normalizedSearch.split(' ').filter(word => word.length > 0);
  const productText = `${normalizedName} ${normalizedDescription}`;
  
  return searchWords.every(searchWord => 
    productText.includes(searchWord) || 
    normalizedName.split(' ').some(nameWord => nameWord.startsWith(searchWord))
  );
};

const SearchableProductSelector = ({ 
  products, 
  selectedProductId, 
  onProductSelect,
  placeholder = "Buscar producto..."
}: SearchableProductSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    console.log('Filtering products with search term:', searchTerm);
    const filtered = products.filter(product => matchesSearch(product, searchTerm));
    console.log('Filtered results:', filtered.map(p => p.name));
    return filtered;
  }, [products, searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedProduct ? (
            <div className="flex items-center space-x-3">
              {selectedProduct.image_url ? (
                <img 
                  src={selectedProduct.image_url} 
                  alt={selectedProduct.name}
                  className="w-6 h-6 rounded object-cover"
                />
              ) : (
                <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center">
                  <Package className="w-3 h-3 text-gray-500" />
                </div>
              )}
              <span className="truncate">{selectedProduct.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 z-[100] bg-white border shadow-lg max-h-[400px] overflow-hidden" 
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '300px' }}
      >
        <Command className="flex flex-col h-full max-h-[400px]" shouldFilter={false}>
          <CommandInput 
            placeholder="Buscar producto..." 
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="border-b"
          />
          <CommandList className="flex-1 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <CommandEmpty>No se encontraron productos.</CommandEmpty>
            ) : (
              <CommandGroup className="p-0">
                {filteredProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      onProductSelect(product.id);
                      setOpen(false);
                      setSearchTerm('');
                    }}
                    className="flex items-center space-x-3 p-3 cursor-pointer hover:bg-gray-50"
                  >
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4",
                            selectedProductId === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableProductSelector;
