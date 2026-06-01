import assert from 'node:assert/strict';
import {
  classifyDosmicosAngle,
  getAngleDecisionStatus,
  getSpecificAngleLabel,
} from './angleIntelligence';

const sleeping = classifyDosmicosAngle({
  product: 'sleeping-para-bebe',
  adName: 'UGC Sleep 01',
  primaryText: '¿Tu bebé se destapa en la noche? Con este sleeping ya no depende de cobijas sueltas.',
  hookDescription: 'De sufrir con cobijas a dormir tranquilo',
});

assert.equal(sleeping.angleFamily, 'problem_solution');
assert.equal(sleeping.specificAngle, 'sleeping_se_destapa_sin_cobijas');
assert.equal(sleeping.hookPattern, 'antes_despues');
assert.equal(sleeping.buyerProblem, 'bebe_se_destapa');
assert.equal(sleeping.desiredOutcome, 'duerme_abrigado_sin_cobijas_sueltas');
assert.equal(sleeping.proofType, 'producto_en_uso_real');
assert.equal(sleeping.angleConfidence, 'high');

const ruana = classifyDosmicosAngle({
  product: 'ruanas',
  adName: 'AD 08 - Ruanas uso diario facil de poner',
  primaryText: 'Se la pongo en 3 segundos, como una cobijita puesta para salir de afán.',
});

assert.equal(ruana.specificAngle, 'ruana_facil_de_poner');
assert.equal(getSpecificAngleLabel(ruana.specificAngle), 'Ruana — fácil de poner');

assert.equal(
  getAngleDecisionStatus({ spend: 190000, purchases: 4, roas: 3.2, cpa: 47500, adCount: 2 }),
  'winner',
);
assert.equal(
  getAngleDecisionStatus({ spend: 130000, purchases: 0, roas: 0, cpa: 0, adCount: 3 }),
  'loser',
);
assert.equal(
  getAngleDecisionStatus({ spend: 90000, purchases: 1, roas: 1.9, cpa: 90000, adCount: 1 }),
  'promising',
);

console.log('angleIntelligence tests passed');
