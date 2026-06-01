export type AngleFamily =
  | 'problem_solution'
  | 'product_benefit'
  | 'use_case'
  | 'gift'
  | 'social_proof'
  | 'technical_education'
  | 'lifestyle'
  | 'offer'
  | 'other';

export type HookPattern =
  | 'antes_despues'
  | 'pregunta_problema'
  | 'pov_mama'
  | 'demo_rapida'
  | 'error_comun'
  | 'comparacion'
  | 'recomendacion_amiga'
  | 'beneficio_directo'
  | 'otro';

export type AngleDecisionStatus = 'winner' | 'promising' | 'loser' | 'needs_data';

export interface AngleClassificationInput {
  product?: string | null;
  productName?: string | null;
  adName?: string | null;
  primaryText?: string | null;
  headline?: string | null;
  hookDescription?: string | null;
}

export interface AngleClassification {
  angleFamily: AngleFamily;
  specificAngle: string;
  hookPattern: HookPattern;
  buyerProblem: string;
  desiredOutcome: string;
  proofType: string;
  angleConfidence: 'high' | 'medium' | 'low';
  needsHumanReview: boolean;
}

export interface AngleDecisionInput {
  spend: number;
  purchases: number;
  roas: number;
  cpa: number;
  adCount: number;
}

export const SPECIFIC_ANGLE_LABELS: Record<string, string> = {
  sleeping_se_destapa_sin_cobijas: 'Sleeping — se destapa / sin cobijas',
  sleeping_rutina_noche_tranquila: 'Sleeping — rutina de noche tranquila',
  sleeping_tog_clima_correcto: 'Sleeping — TOG / clima correcto',
  sleeping_bebe_abrigado_sin_sobrecalentar: 'Sleeping — bebé abrigado sin sobrecalentar',
  ruana_facil_de_poner: 'Ruana — fácil de poner',
  ruana_cobijita_puesta: 'Ruana — cobijita puesta',
  ruana_animalitos_ninos_la_aman: 'Ruana — animalitos que los niños aman',
  ruana_regalo_util: 'Ruana — regalo útil',
  ruana_casa_carro_jardin: 'Ruana — casa / carro / jardín',
  parka_tierra_fria: 'Parka — tierra fría',
  parka_frio_lluvia_salidas: 'Parka — frío / lluvia / salidas',
  parka_viaje_clima_frio: 'Parka — viaje a clima frío',
  parka_abrigo_sin_peso: 'Parka — abrigo sin peso',
  generic_product_benefit: 'Beneficio de producto genérico',
  unknown: 'Sin ángulo claro',
};

const normalize = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ');

const includesAny = (text: string, needles: string[]) => needles.some((needle) => text.includes(needle));

export function getSpecificAngleLabel(angle?: string | null): string {
  if (!angle) return SPECIFIC_ANGLE_LABELS.unknown;
  return SPECIFIC_ANGLE_LABELS[angle] || angle.replace(/_/g, ' ');
}

export function getHookPattern(textInput?: string | null): HookPattern {
  const text = normalize(textInput);

  if (includesAny(text, ['antes', 'despues', 'de sufrir', 'a dormir', 'de estar'])) return 'antes_despues';
  if (text.includes('?') || includesAny(text, ['tu bebe se', 'tu hijo', 'sabias', 'te pasa'])) return 'pregunta_problema';
  if (includesAny(text, ['pov', 'como mama', 'mi bebe', 'mi hijo', 'nuestra rutina'])) return 'pov_mama';
  if (includesAny(text, ['en 3 segundos', 'asi se', 'mira como', 'se la pongo'])) return 'demo_rapida';
  if (includesAny(text, ['error', 'no hagas', 'deja de'])) return 'error_comun';
  if (includesAny(text, ['vs', 'en vez de', 'comparado'])) return 'comparacion';
  if (includesAny(text, ['te recomiendo', 'me encanta', 'mi favorita'])) return 'recomendacion_amiga';
  if (includesAny(text, ['abriga', 'suave', 'comodo', 'facil', 'practico'])) return 'beneficio_directo';

  return 'otro';
}

export function classifyDosmicosAngle(input: AngleClassificationInput): AngleClassification {
  const productText = normalize(`${input.product || ''} ${input.productName || ''}`);
  const allText = normalize(
    `${input.product || ''} ${input.productName || ''} ${input.adName || ''} ${input.primaryText || ''} ${input.headline || ''} ${input.hookDescription || ''}`,
  );
  const hookText = `${input.hookDescription || ''} ${input.primaryText || ''} ${input.headline || ''}`;
  const hookPattern = getHookPattern(hookText);

  const isSleeping = includesAny(productText + allText, ['sleeping', 'saco de dormir', 'sleep bag']);
  const isRuana = includesAny(productText + allText, ['ruana', 'ruanas', 'cobijita puesta']);
  const isParka = includesAny(productText + allText, ['parka', 'chaqueta', 'teddy', 'osito']);

  if (isSleeping) {
    if (includesAny(allText, ['destapa', 'cobija', 'cobijas sueltas', 'sin cobijas'])) {
      return {
        angleFamily: 'problem_solution',
        specificAngle: 'sleeping_se_destapa_sin_cobijas',
        hookPattern,
        buyerProblem: 'bebe_se_destapa',
        desiredOutcome: 'duerme_abrigado_sin_cobijas_sueltas',
        proofType: 'producto_en_uso_real',
        angleConfidence: 'high',
        needsHumanReview: false,
      };
    }
    if (includesAny(allText, ['rutina', 'noche', 'dormir tranquilo', 'hora de dormir'])) {
      return {
        angleFamily: 'use_case',
        specificAngle: 'sleeping_rutina_noche_tranquila',
        hookPattern,
        buyerProblem: 'rutina_noche_dificil',
        desiredOutcome: 'rutina_noche_practica',
        proofType: 'producto_en_uso_real',
        angleConfidence: 'medium',
        needsHumanReview: false,
      };
    }
    if (includesAny(allText, ['tog', 'clima', 'temperatura', 'frio', 'calor'])) {
      return {
        angleFamily: 'technical_education',
        specificAngle: 'sleeping_tog_clima_correcto',
        hookPattern,
        buyerProblem: 'no_saber_como_abrigar_bebe',
        desiredOutcome: 'elegir_tog_correcto',
        proofType: 'educacion_producto',
        angleConfidence: 'medium',
        needsHumanReview: false,
      };
    }
  }

  if (isRuana) {
    if (includesAny(allText, ['facil de poner', '3 segundos', 'afán', 'afan', 'rapido', 'rapida'])) {
      return {
        angleFamily: 'product_benefit',
        specificAngle: 'ruana_facil_de_poner',
        hookPattern,
        buyerProblem: 'chaquetas_dificiles_o_afan',
        desiredOutcome: 'poner_en_segundos',
        proofType: 'demo_producto',
        angleConfidence: 'high',
        needsHumanReview: false,
      };
    }
    if (includesAny(allText, ['cobijita puesta', 'cobija puesta', 'libertad', 'jugar', 'moverse'])) {
      return {
        angleFamily: 'use_case',
        specificAngle: 'ruana_cobijita_puesta',
        hookPattern,
        buyerProblem: 'nino_se_enfria_pero_quiere_moverse',
        desiredOutcome: 'abrigo_con_libertad',
        proofType: 'producto_en_uso_real',
        angleConfidence: 'high',
        needsHumanReview: false,
      };
    }
    if (includesAny(allText, ['animalito', 'animalitos', 'oso', 'oveja', 'vaca', 'tierno', 'tierna'])) {
      return {
        angleFamily: 'product_benefit',
        specificAngle: 'ruana_animalitos_ninos_la_aman',
        hookPattern,
        buyerProblem: 'nino_no_quiere_abrigo',
        desiredOutcome: 'nino_quiere_usarla',
        proofType: 'producto_en_uso_real',
        angleConfidence: 'medium',
        needsHumanReview: false,
      };
    }
    if (includesAny(allText, ['regalo', 'baby shower', 'babyshower'])) {
      return {
        angleFamily: 'gift',
        specificAngle: 'ruana_regalo_util',
        hookPattern,
        buyerProblem: 'regalos_que_no_usan',
        desiredOutcome: 'regalo_lindo_y_practico',
        proofType: 'beneficio_producto',
        angleConfidence: 'medium',
        needsHumanReview: false,
      };
    }
  }

  if (isParka) {
    if (includesAny(allText, ['tierra fria', 'clima frio', 'viaje'])) {
      return {
        angleFamily: 'use_case',
        specificAngle: 'parka_tierra_fria',
        hookPattern,
        buyerProblem: 'viaje_o_clima_frio_real',
        desiredOutcome: 'abrigo_funcional_para_tierra_fria',
        proofType: 'producto_en_uso_real',
        angleConfidence: 'high',
        needsHumanReview: false,
      };
    }
    if (includesAny(allText, ['lluvia', 'viento', 'salidas', 'salir'])) {
      return {
        angleFamily: 'use_case',
        specificAngle: 'parka_frio_lluvia_salidas',
        hookPattern,
        buyerProblem: 'frio_lluvia_viento_en_salidas',
        desiredOutcome: 'proteccion_para_salir',
        proofType: 'producto_en_uso_real',
        angleConfidence: 'medium',
        needsHumanReview: false,
      };
    }
  }

  return {
    angleFamily: includesAny(allText, ['regalo']) ? 'gift' : 'other',
    specificAngle: includesAny(allText, ['suave', 'abriga', 'comodo', 'practico']) ? 'generic_product_benefit' : 'unknown',
    hookPattern,
    buyerProblem: 'unknown',
    desiredOutcome: 'unknown',
    proofType: includesAny(allText, ['ugc', '@', 'mi bebe', 'mi hijo']) ? 'producto_en_uso_real' : 'unknown',
    angleConfidence: 'low',
    needsHumanReview: true,
  };
}

export function getAngleDecisionStatus(input: AngleDecisionInput): AngleDecisionStatus {
  const { spend, purchases, roas, cpa, adCount } = input;

  if (spend >= 150000 && purchases >= 3 && roas >= 1.8 && (adCount >= 2 || spend >= 250000)) {
    return 'winner';
  }

  if (spend >= 120000 && (purchases === 0 || (cpa > 0 && cpa >= 120000 && roas < 1.2))) {
    return 'loser';
  }

  if ((purchases >= 1 && roas >= 1.5) || (spend >= 80000 && roas >= 1.5)) {
    return 'promising';
  }

  return 'needs_data';
}

export function getAngleDecisionLabel(status: AngleDecisionStatus): string {
  const labels: Record<AngleDecisionStatus, string> = {
    winner: 'Winner',
    promising: 'Promising',
    loser: 'Loser',
    needs_data: 'Needs data',
  };
  return labels[status];
}
