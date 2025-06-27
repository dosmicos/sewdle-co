
import React, { useState } from 'react';
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

const SearchableProductSelector = ({ 
  products, 
  selectedProductId, 
  onProductSelect,
  placeholder = "Buscar producto..."
}: SearchableProductSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchValue.toLowerCase()))
  );

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
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Buscar producto..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No se encontraron productos.</CommandEmpty>
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => {
                    onProductSelect(product.id);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  className="flex items-center space-x-3 p-3 cursor-pointer"
                >
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                        <Package className="w-6 h-6 text-gray-400" />
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
                    
                    {product.description && (
                      <p className="text-sm text-gray-500 truncate">
                        {product.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-medium text-blue-600">
                        ${product.base_price.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {product.variants.length} variantes
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableProductSelector;
