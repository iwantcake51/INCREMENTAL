import { GENERATORS } from '../data/generators';

/**
 * Every multiplier and unlock in the game, derived from upgrades, skills, trials and achievements.
 * Recomputed only when one of those sources changes (see Game.invalidate), never per frame.
 */
export interface Mods {
  genMult: number[];
  prodMult: number;
  prodAdd: number;
  prodExp: number;
  clickBase: number;
  clickMult: number;
  clickCpsPct: number;
  critChance: number;
  critMult: number;
  comboCap: number;
  comboPer: number;
  comboDecay: number;
  costMult: number;
  costGrowth: number;
  upgradeCostMult: number;
  cometInterval: number;
  cometPower: number;
  buffDuration: number;
  buffPower: number;
  frenzyMult: number;
  clickstormMult: number;
  cometAuto: boolean;
  twinCometChance: number;
  wishChance: number;
  shardMult: number;
  shardExp: number;
  shardPer: number;
  achPer: number;
  offlineEff: number;
  offlineCapH: number;
  autoClickRate: number;
  autoClickCombo: boolean;
  critCombo: boolean;
  autoGens: boolean;
  autoUpgrades: boolean;
  autoRebirth: boolean;
  startStardust: number;
  startGens: number;
  keepUpgrades: boolean;
  trialsUnlocked: boolean;
  patienceCap: number;
  resonance: number;
  wanderPer: number;
  synergy: { target: number; source: number; pct: number }[];
  // Trial restrictions
  noClick: boolean;
  noGenProd: boolean;
  noUpgrades: boolean;
  noComets: boolean;
  noSkills: boolean;
  maxGenIndex: number;
  entropy: boolean;
}

export function baseMods(): Mods {
  return {
    genMult: GENERATORS.map(() => 1),
    prodMult: 1,
    prodAdd: 0,
    prodExp: 1,
    clickBase: 1,
    clickMult: 1,
    clickCpsPct: 0,
    critChance: 0.02,
    critMult: 10,
    comboCap: 50,
    comboPer: 0.01,
    comboDecay: 1.25,
    costMult: 1,
    costGrowth: 1.15,
    upgradeCostMult: 1,
    cometInterval: 1,
    cometPower: 1,
    buffDuration: 1,
    buffPower: 1,
    frenzyMult: 7,
    clickstormMult: 77,
    cometAuto: false,
    twinCometChance: 0,
    wishChance: 0,
    shardMult: 1,
    shardExp: 0.25,
    shardPer: 0.01,
    achPer: 0.01,
    offlineEff: 0.5,
    offlineCapH: 8,
    autoClickRate: 0,
    autoClickCombo: false,
    critCombo: false,
    autoGens: false,
    autoUpgrades: false,
    autoRebirth: false,
    startStardust: 0,
    startGens: 0,
    keepUpgrades: false,
    trialsUnlocked: false,
    patienceCap: 0,
    resonance: 0,
    wanderPer: 0,
    synergy: [],
    noClick: false,
    noGenProd: false,
    noUpgrades: false,
    noComets: false,
    noSkills: false,
    maxGenIndex: GENERATORS.length - 1,
    entropy: false,
  };
}
