import React from 'react';
import { Loader2, Trophy, TrendingUp, Gem, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useProductMVP, type ProductMVP, type ProductClassification } from '@/hooks/useProductMVP';

const formatCOP = (amount: number) => {
  return `COP ${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
};

const QUADRANT_CONFIG: Record<
  Exclude<ProductClassification, 'unclassified'>,
  {
    title: string;
    icon: React.ReactNode;
    bgClass: string;
    borderClass: string;
    badgeClass: string;
    headerClass: string;
  }
> = {
  champion: {
    title: 'Champions',
    icon: <Trophy className="h-4 w-4" />,
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800',
    headerClass: 'text-amber-800',
  },
  growth_driver: {
    title: 'Growth Drivers',
    icon: <TrendingUp className="h-4 w-4" />,
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200',
    badgeClass: 'bg-green-100 text-green-800',
    headerClass: 'text-green-800',
  },
  hidden_gem: {
    title: 'Hidden Gems',
    icon: <Gem className="h-4 w-4" />,
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
    badgeClass: 'bg-violet-100 text-violet-800',
    headerClass: 'text-violet-800',
  },
  underperformer: {
    title: 'Underperformers',
    icon: <AlertTriangle className="h-4 w-4" />,
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-800',
    headerClass: 'text-red-800',
  },
};

const ProductCard: React.FC<{
  product: ProductMVP;
  classification: Exclude<ProductClassification, 'unclassified'>;
}> = ({ product, classification }) => {
  const config = QUADRANT_CONFIG[classification];
  const roasColor =
    product.roas >= 2 ? 'text-green-600' : product.roas >= 1 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-md border border-gray-100 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800 truncate">{product.product_name}</span>
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ml-2 ${config.badgeClass}`}>
          {product.roas.toFixed(2)}x
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>
          <span className="text-gray-500">Spend</span>
          <p className="font-medium text-gray-700">{formatCOP(product.total_spend)}</p>
        </div>
        <div>
          <span className="text-gray-500">Revenue</span>
          <p className={`font-medium ${roasColor}`}>{formatCOP(product.total_revenue)}</p>
        </div>
        <div>
          <span className="text-gray-500">Ads</span>
          <p className="font-medium text-gray-700">{product.ad_count}</p>
        </div>
        <div>
          <span className="text-gray-500">Compras</span>
          <p className="font-medium text-gray-700">{product.total_purchases}</p>
        </div>
      </div>

      {/* Share of spend bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
          <span>Share of spend</span>
          <span>{(product.share_of_spend * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gray-400 transition-all"
            style={{ width: `${Math.min(product.share_of_spend * 100, 100)}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-gray-500 italic leading-tight">{product.recommendation}</p>
    </div>
  );
};

const QuadrantSection: React.FC<{
  classification: Exclude<ProductClassification, 'unclassified'>;
  products: ProductMVP[];
}> = ({ classification, products }) => {
  const config = QUADRANT_CONFIG[classification];

  return (
    <div className={`rounded-lg border ${config.borderClass} ${config.bgClass} p-4`}>
      <div className={`flex items-center gap-2 mb-3 ${config.headerClass}`}>
        {config.icon}
        <h3 className="text-sm font-semibold">{config.title}</h3>
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config.badgeClass}`}>
          {products.length}
        </Badge>
      </div>

      {products.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No hay productos en esta categoria</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <ProductCard key={p.product_name} product={p} classification={classification} />
          ))}
        </div>
      )}
    </div>
  );
};

const ProductMVPMatrix: React.FC = () => {
  const { champions, growthDrivers, hiddenGems, underperformers, unclassified, isLoading, products } =
    useProductMVP();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400 mr-2" />
        <span className="text-sm text-gray-500">Cargando Product MVP Matrix...</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
        <Gem className="h-8 w-8 text-gray-300 mx-auto" />
        <p className="text-sm font-medium text-gray-600 mt-3">No hay datos de producto</p>
        <p className="text-xs text-gray-500 mt-1">
          Asegurate de que los ads tengan tags de producto asignados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuadrantSection classification="champion" products={champions} />
        <QuadrantSection classification="growth_driver" products={growthDrivers} />
        <QuadrantSection classification="hidden_gem" products={hiddenGems} />
        <QuadrantSection classification="underperformer" products={underperformers} />
      </div>

      {/* Unclassified products summary */}
      {unclassified.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Sin clasificar ({unclassified.length} productos)
          </h3>
          <div className="flex flex-wrap gap-2">
            {unclassified.map((p) => (
              <div
                key={p.product_name}
                className="flex items-center gap-2 bg-gray-50 rounded px-2.5 py-1.5 text-xs"
              >
                <span className="text-gray-700 font-medium">{p.product_name}</span>
                <span className="text-gray-500">ROAS {p.roas.toFixed(2)}x</span>
                <span className="text-gray-400">{formatCOP(p.total_spend)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMVPMatrix;
