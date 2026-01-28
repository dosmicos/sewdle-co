

# Plan: Validación de Municipios con Opciones "Sí, continuar" y "No"

## Resumen del Cambio

Cuando la ciudad no coincide exactamente, se mostrarán dos opciones:
- **"Sí, continuar con [Ciudad]"**: Acepta la sugerencia y permite crear la guía
- **"No, corregir en Shopify"**: Rechaza la sugerencia y bloquea la creación hasta que se corrija manualmente

## Flujo de Usuario

```text
┌─────────────────────────────────────────────────────────────────┐
│  CASO 1: Ciudad correcta "Siachoque"                            │
├─────────────────────────────────────────────────────────────────┤
│  Match: exact                                                   │
│  → No se muestra alerta                                         │
│  → Botón "Crear Guía" habilitado normalmente                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CASO 2: Ciudad mal escrita "Siachique" - Usuario acepta       │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ⚠️ Ciudad no reconocida                                    │  │
│  │                                                           │  │
│  │ "Siachique" no coincide exactamente.                      │  │
│  │ ¿Quisiste decir Siachoque, Boyacá?                        │  │
│  │                                                           │  │
│  │  [Sí, continuar con Siachoque]  [No, corregir en Shopify] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  → Usuario hace clic en "Sí, continuar"                         │
│  → Sistema usa "Siachoque" para crear la guía                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CASO 3: Ciudad mal escrita "Siachique" - Usuario rechaza      │
├─────────────────────────────────────────────────────────────────┤
│  → Usuario hace clic en "No, corregir en Shopify"               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ❌ Corrección requerida                                    │  │
│  │                                                           │  │
│  │ Debes corregir la ciudad en Shopify antes de crear la     │  │
│  │ guía. Luego recarga este pedido.                          │  │
│  │                                                           │  │
│  │                              [Volver a verificar]          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  → Botón "Crear Guía" permanece DESHABILITADO                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CASO 4: Ciudad inventada "XYZ123"                              │
├─────────────────────────────────────────────────────────────────┤
│  Match: not_found                                               │
│  → Mensaje: "Ciudad no reconocida. No hay municipios similares" │
│  → Botón deshabilitado, sin opciones                            │
└─────────────────────────────────────────────────────────────────┘
```

## Cambios Técnicos

### 1. Modificar Edge Function `envia-quote`

**Archivo:** `supabase/functions/envia-quote/index.ts`

Agregar función de similitud Levenshtein y retornar `matchInfo` en la respuesta:

```typescript
// Nueva función para calcular distancia Levenshtein
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length, n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s1[i-1] === s2[j-1] 
        ? dp[i-1][j-1] 
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const s2 = str2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshteinDistance(s1, s2)) / maxLen;
}
```

Modificar la función de búsqueda DANE para retornar información de match:

```typescript
async function getDaneCodeWithMatchInfo(supabase: any, city: string, department?: string): Promise<{
  daneCode: string;
  matchType: 'exact' | 'fuzzy' | 'not_found';
  matchedMunicipality: string | null;
  matchedDepartment: string | null;
  suggestions: Array<{ municipality: string; department: string; similarity: number }>;
}> {
  // 1. Intentar match exacto primero
  // 2. Si no hay exacto, buscar todos los municipios y calcular similitud
  // 3. Filtrar los que tengan similitud > 0.7
  // 4. Ordenar por similitud descendente
  // 5. Retornar el mejor match como sugerencia
}
```

Nueva estructura de respuesta del endpoint:

```typescript
{
  success: true,
  quotes: [...],
  destination: {
    city: "Siachoque",      // Ciudad que se usaría (la sugerida o la original)
    department: "Boyacá",
    state_code: "BY",
    dane_code: "15740000"
  },
  matchInfo: {
    matchType: 'fuzzy',           // 'exact' | 'fuzzy' | 'not_found'
    inputCity: "Siachique",       // Lo que escribió el usuario
    matchedMunicipality: "Siachoque",
    matchedDepartment: "Boyacá",
    confidence: 0.88,
    suggestions: [
      { municipality: "Siachoque", department: "Boyacá", similarity: 0.88 }
    ]
  }
}
```

### 2. Actualizar Tipos TypeScript

**Archivo:** `src/features/shipping/types/envia.ts`

```typescript
export interface CityMatchInfo {
  matchType: 'exact' | 'fuzzy' | 'not_found';
  inputCity: string;
  matchedMunicipality: string | null;
  matchedDepartment: string | null;
  confidence: number;
  suggestions: Array<{
    municipality: string;
    department: string;
    similarity: number;
  }>;
}

export interface QuoteResponse {
  success: boolean;
  quotes: CarrierQuote[];
  domicilio: CarrierQuote[];
  oficina: CarrierQuote[];
  destination: {
    city: string;
    department: string;
    state_code: string;
    dane_code?: string;
  };
  matchInfo?: CityMatchInfo;
  error?: string;
}
```

### 3. Modificar Hook `useEnviaShipping`

**Archivo:** `src/features/shipping/hooks/useEnviaShipping.ts`

```typescript
// Nuevo estado
const [matchInfo, setMatchInfo] = useState<CityMatchInfo | null>(null);

// En getQuotes, guardar matchInfo de la respuesta
const getQuotes = useCallback(async (request: QuoteRequest): Promise<QuoteResponse | null> => {
  // ... código existente ...
  if (data.matchInfo) {
    setMatchInfo(data.matchInfo);
  }
  return data as QuoteResponse;
}, []);

// Exponer en el return
return {
  // ... existente ...
  matchInfo,
  clearMatchInfo: () => setMatchInfo(null)
};
```

### 4. Modificar Componente `EnviaShippingButton`

**Archivo:** `src/features/shipping/components/EnviaShippingButton.tsx`

**A. Nuevos estados:**
```typescript
const [correctedCity, setCorrectedCity] = useState<string | null>(null);
const [userRejectedSuggestion, setUserRejectedSuggestion] = useState(false);
```

**B. UI con dos botones - Aceptar o Rechazar:**
```typescript
{/* Alerta cuando hay match fuzzy y usuario aún no ha decidido */}
{matchInfo && matchInfo.matchType === 'fuzzy' && 
 matchInfo.suggestions.length > 0 && 
 !correctedCity && 
 !userRejectedSuggestion && (
  <Alert className="mb-3 border-amber-200 bg-amber-50">
    <AlertCircle className="h-4 w-4 text-amber-600" />
    <AlertTitle className="text-amber-800">Ciudad no reconocida</AlertTitle>
    <AlertDescription className="text-amber-700">
      <p className="mb-2">
        "{matchInfo.inputCity}" no coincide exactamente con ningún municipio.
      </p>
      <p className="font-medium mb-3">
        ¿Quisiste decir <strong>{matchInfo.suggestions[0].municipality}</strong>, 
        {matchInfo.suggestions[0].department}?
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-white border-green-300 hover:bg-green-50 text-green-700"
          onClick={() => {
            setCorrectedCity(matchInfo.suggestions[0].municipality);
            toast.success(`Ciudad corregida a: ${matchInfo.suggestions[0].municipality}`);
          }}
        >
          <Check className="h-4 w-4 mr-2" />
          Sí, continuar con {matchInfo.suggestions[0].municipality}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-white border-red-300 hover:bg-red-50 text-red-700"
          onClick={() => {
            setUserRejectedSuggestion(true);
            toast.info("Corrige la ciudad en Shopify y vuelve a verificar");
          }}
        >
          <X className="h-4 w-4 mr-2" />
          No, corregir en Shopify
        </Button>
      </div>
    </AlertDescription>
  </Alert>
)}
```

**C. Alerta cuando usuario rechazó la sugerencia:**
```typescript
{/* Alerta cuando usuario rechazó - bloqueo total */}
{userRejectedSuggestion && (
  <Alert variant="destructive" className="mb-3">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Corrección requerida</AlertTitle>
    <AlertDescription>
      <p className="mb-2">
        Debes corregir la ciudad en Shopify antes de crear la guía.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2 bg-white"
        onClick={() => {
          setUserRejectedSuggestion(false);
          setCorrectedCity(null);
          // Volver a obtener quotes para re-verificar
          handleGetQuotes();
        }}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Volver a verificar
      </Button>
    </AlertDescription>
  </Alert>
)}
```

**D. Alerta cuando no hay sugerencias:**
```typescript
{/* Alerta cuando no hay sugerencias posibles */}
{matchInfo && matchInfo.matchType === 'not_found' && (
  <Alert variant="destructive" className="mb-3">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Ciudad no reconocida</AlertTitle>
    <AlertDescription>
      No se encontró "{matchInfo.inputCity}" en la base de datos y no hay 
      municipios similares. Corrige la dirección en Shopify.
    </AlertDescription>
  </Alert>
)}
```

**E. Lógica de habilitación del botón:**
```typescript
// Permitir crear guía SOLO si:
// 1. Match exacto, O
// 2. Match fuzzy Y usuario aceptó corrección (correctedCity tiene valor)
// NO permitir si: userRejectedSuggestion es true
const canCreateLabel = 
  shippingAddress?.city && 
  shippingAddress?.address1 && 
  !userRejectedSuggestion &&
  (matchInfo?.matchType === 'exact' || correctedCity !== null);
```

**F. Usar ciudad corregida al crear guía:**
```typescript
const handleCreateLabel = async () => {
  // Usar ciudad corregida si existe, sino la original
  const city = correctedCity || shippingAddress.city || '';
  
  const result = await createLabel({
    // ... otros campos ...
    destination_city: city,
    // ...
  });
};
```

**G. Reset al cambiar de pedido:**
```typescript
useEffect(() => {
  if (currentOrganization?.id && shopifyOrderId) {
    setCorrectedCity(null);
    setUserRejectedSuggestion(false);
    clearMatchInfo();
    // ... resto del código existente ...
  }
}, [shopifyOrderId, currentOrganization?.id]);
```

## Archivos a Modificar

| Archivo | Acción | Cambios Principales |
|---------|--------|---------------------|
| `supabase/functions/envia-quote/index.ts` | Modificar | Agregar Levenshtein, retornar `matchInfo` |
| `src/features/shipping/types/envia.ts` | Modificar | Agregar tipo `CityMatchInfo` |
| `src/features/shipping/hooks/useEnviaShipping.ts` | Modificar | Exponer `matchInfo` |
| `src/features/shipping/components/EnviaShippingButton.tsx` | Modificar | UI con 2 botones, lógica de bloqueo |

## Resumen de Estados

| Estado | Descripción | Botón "Crear Guía" |
|--------|-------------|-------------------|
| `matchType: 'exact'` | Ciudad coincide perfectamente | Habilitado |
| `matchType: 'fuzzy'` + sin decisión | Usuario debe elegir | Deshabilitado |
| `matchType: 'fuzzy'` + `correctedCity` | Usuario aceptó sugerencia | Habilitado |
| `matchType: 'fuzzy'` + `userRejectedSuggestion` | Usuario rechazó | Deshabilitado |
| `matchType: 'not_found'` | Sin coincidencias | Deshabilitado |

