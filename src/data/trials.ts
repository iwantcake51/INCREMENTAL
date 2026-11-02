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
    id: 't_silent', name: 'Silent Hands', icon: 'interdiction', goal: 1e10,
    rule: 'You cannot click the star. Auto-clicks are disabled.',
    reward: 'All production ×3',
    restrict: (m) => { m.noClick = true; },
    bonus: (m) => { m.prodMult *= 3; },
  },
  {
    id: 't_idle', name: 'Idle Ban', icon: 'stop-sign', goal: 1e7,
    rule: 'Generators produce nothing. Your hands are all you have.',
    reward: 'Click power ×10 and +2% of production per click',
    restrict: (m) => { m.noGenProd = true; },
    bonus: (m) => { m.clickMult *= 10; m.clickCpsPct += 0.02; },
  },
  {
    id: 't_inflation', name: 'Inflation', icon: 'coins-pile', goal: 1e11,
    rule: 'Generator prices grow ×1.25 per purchase instead of ×1.15.',
    reward: 'Generator price growth −0.01',
    restrict: (m) => { m.costGrowth += 0.1; },
    bonus: (m) => { m.costGrowth -= 0.01; },
  },
  {
    id: 't_barren', name: 'Barren Sky', icon: 'padlock', goal: 1e9,
    rule: 'Upgrades cannot be purchased.',
    reward: 'Upgrades cost 50% less',
    restrict: (m) => { m.noUpgrades = true; },
    bonus: (m) => { m.upgradeCostMult *= 0.5; },
  },
  {
    id: 't_lonely', name: 'Lonely Void', icon: 'moon', goal: 1e9,
    rule: 'Only the first four generators can be built.',
    reward: 'First four generators ×25',
    restrict: (m) => { m.maxGenIndex = 3; },
    bonus: (m) => { for (let i = 0; i < 4; i++) m.genMult[i] *= 25; },
  },
  {
    id: 't_dim', name: 'Dim Star', icon: 'concentric-crescents', goal: 1e10,
    rule: 'Production is raised to ^0.85 and comets never come.',
    reward: 'Production ^1.03',
    restrict: (m) => { m.prodExp *= 0.85; m.noComets = true; },
    bonus: (m) => { m.prodExp += 0.03; },
  },
  {
    id: 't_entropy', name: 'Entropy', icon: 'time-trap', goal: 1e12,
    rule: 'Production decays 2% per second since your last generator purchase.',
    reward: 'Nova Shards ×2',
    restrict: (m) => { m.entropy = true; },
    bonus: (m) => { m.shardMult *= 2; },
  },
  {
    id: 't_drought', name: 'Nova Drought', icon: 'heat-haze', goal: 1e10,
    rule: 'Your constellation and shard bonus are dormant.',
    reward: 'Each Nova Shard gives +0.5% more production',
    restrict: (m) => { m.noSkills = true; },
    bonus: (m) => { m.shardPer += 0.005; },
  },
];

export const TRIAL_MAP = new Map(TRIALS.map((t) => [t.id, t]));
