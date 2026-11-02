import type { Mods } from '../core/mods';

export interface TrialDef {
  id: string;
  name: string;
  icon: string;
  rule: string;
  goal: number;
  reward: string;
  restrict: (m: Mods) => void;
  bonus: (m: Mods) => void;
}

export const TRIALS: TrialDef[] = [
  {
    id: 't_silent', name: 'Still Water', icon: 'interdiction', goal: 1e10,
    rule: "You can't touch the lure, and your echo hands stay still.",
    reward: 'All production ×3',
    restrict: (m) => { m.noClick = true; },
    bonus: (m) => { m.prodMult *= 3; },
  },
  {
    id: 't_idle', name: 'Dead Reef', icon: 'fishbone', goal: 1e7,
    rule: 'Your harvesters produce nothing. Only your hands work down here.',
    reward: 'Lure power ×10 and +2% of production per tap',
    restrict: (m) => { m.noGenProd = true; },
    bonus: (m) => { m.clickMult *= 10; m.clickCpsPct += 0.02; },
  },
  {
    id: 't_inflation', name: 'Crushing Pressure', icon: 'coins-pile', goal: 1e11,
    rule: 'Harvester prices climb ×1.25 per purchase instead of ×1.15.',
    reward: 'Harvester price growth −0.01',
    restrict: (m) => { m.costGrowth += 0.1; },
    bonus: (m) => { m.costGrowth -= 0.01; },
  },
  {
    id: 't_barren', name: 'Empty Workshop', icon: 'padlock', goal: 1e9,
    rule: 'The workshop is closed. No upgrades.',
    reward: 'Upgrades cost half as much',
    restrict: (m) => { m.noUpgrades = true; },
    bonus: (m) => { m.upgradeCostMult *= 0.5; },
  },
  {
    id: 't_lonely', name: 'Shallow End', icon: 'sea-star', goal: 1e9,
    rule: 'Only the first four harvesters can be built.',
    reward: 'First four harvesters ×25',
    restrict: (m) => { m.maxGenIndex = 3; },
    bonus: (m) => { for (let i = 0; i < 4; i++) m.genMult[i] *= 25; },
  },
  {
    id: 't_dim', name: 'Murk', icon: 'concentric-crescents', goal: 1e10,
    rule: 'Production is raised to ^0.85 and no glimmerfish come near.',
    reward: 'Production ^1.03',
    restrict: (m) => { m.prodExp *= 0.85; m.noComets = true; },
    bonus: (m) => { m.prodExp += 0.03; },
  },
  {
    id: 't_entropy', name: 'Slow Leak', icon: 'time-trap', goal: 1e12,
    rule: 'Production drains 2% every second since you last built a harvester.',
    reward: 'Black Pearls ×2',
    restrict: (m) => { m.entropy = true; },
    bonus: (m) => { m.shardMult *= 2; },
  },
  {
    id: 't_drought', name: 'Bleached Reef', icon: 'heat-haze', goal: 1e10,
    rule: 'The Reef sleeps and your Black Pearls lose their shine.',
    reward: 'Each Black Pearl gives +0.5% more production',
    restrict: (m) => { m.noSkills = true; },
    bonus: (m) => { m.shardPer += 0.005; },
  },
];

export const TRIAL_MAP = new Map(TRIALS.map((t) => [t.id, t]));
