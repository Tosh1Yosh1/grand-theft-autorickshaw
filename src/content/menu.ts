import type { Line } from './lines';

export const MENU = {
  title: 'Grand Theft Auto-Rickshaw',
  subtitle: 'Mumbhai Bhaukaal',
  continue: 'Continue',
  newGame: 'Naya Game',
  settings: 'Settings',
  controls: 'Controls',
  credits: 'Credits',
  confirmNew: 'Purana save delete ho jayega. Pakka? (EMI wapas zero nahi hogi)',
  gateTitle: '18+ WARNING',
  gateText:
    'Yeh game 18+ hai: Hinglish gaaliyan, cartoon maar-peet, aur Mumbhai ke gaddhe. Sab fictional hai: log, brands, neta, sab. Mazak situations pe hai, kisi community pe nahi.',
  gateDirty: 'Haan, gaaliyan ON (full Bhaukaal)',
  gateClean: 'Clean version (Mummy dekh rahi hai)',
  credits_text:
    'Code, city, characters, music and every joke: original, procedural, made for this project. Libraries: three.js (MIT), Rapier (Apache-2.0), howler.js (MIT), lil-gui (MIT), zustand (MIT). Not affiliated with any real game, company, person or neta. Any resemblance to real potholes is entirely accurate.',
};

/** Shown on the loading screen while the city is being built. */
export const LOADING_STEPS: readonly string[] = [
  'Gaddhe khod rahe hain...',
  'Bijli ke taar uljha rahe hain...',
  'Gaay ko beech road pe bitha rahe hain...',
  'Auto ka meter tez kar rahe hain...',
  'Chacha ke Good Morning forward download ho rahe hain...',
  'Flyover adhoora chhod rahe hain...',
  'Startup Bro ko jaga rahe hain...',
];

export const MENU_TAGLINES: readonly Line[] = [
  'Mere paas EMI hai.',
  'Meter down. Bhaukaal up.',
  'Ek auto. Teen EMI. Ek sapna.',
  { dirty: 'Mumbhai mein bhaukaal ya toh hai, ya bc nahi hai.', clean: 'Mumbhai mein bhaukaal ya toh hai, ya nahi hai.' },
];
