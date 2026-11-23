/** Parody billboards. All brands fictional. [headline, subline, bg, fg] */
export const HOARDINGS: readonly [string, string, string, string][] = [
  ['FAIR & HAPPY', 'Gora nahi, par khush toh ho jaoge*', '#ff6fa8', '#ffffff'],
  ['INSTANT LOAN', 'Interest: YES. Approval: 2 min. Recovery: forever.', '#1d3557', '#ffd166'],
  ['IIT COACHING', 'For your unborn child. Batch starts at conception.', '#f1faee', '#e63946'],
  ['AMAZIN PANDEY DELIVERY', 'Same day. Kaunsa din, yeh mat poocho.', '#ff9f1c', '#1b1b1b'],
  ['BOTALWALA MINERAL WATER', '100% Botal. Paani optional.', '#06d6a0', '#073b4c'],
  ['NETAJI KO VOTE DO', 'Gaddha-mukt Mumbhai*  (*T&C: gaddhe included)', '#ffffff', '#d62828'],
  ['CHAI.AI', 'Disrupting cutting chai with blockchain', '#2b2d42', '#8ecae6'],
  ['BHAUKAAL FM 98.3', 'Gaane kam, dedication zyada', '#7209b7', '#ffbe0b'],
  ['SHAADI.COMPROMISE', 'Mummy ne pasand kiya hai. Bas.', '#e9c46a', '#264653'],
  ['DENTING-PAINTING', 'Police waale bhi pehchaan nahi paayenge', '#264653', '#e9c46a'],
  ['RAJU REAL ESTATE', '1 BHK in 5 Cr. Balcony extra. Hawa extra.', '#3a86ff', '#ffffff'],
  ['ASTRO AUNTY', 'Problem kuch bhi ho, Mercury ka haath hai', '#9d0208', '#ffba08'],
];

export const DISTRICT_INFO: Record<string, { name: string; tagline: string; color: string }> = {
  jugaadpur: { name: 'Jugaadpur', tagline: 'Galiyan patli, dil bade, wiring bhagwan bharose', color: '#ff9f1c' },
  startup: { name: 'Startup Nagar', tagline: 'Vada pav ₹400. Valuation ₹400 crore. Profit ₹0.', color: '#4cc9f0' },
  filmistan: { name: 'Filmistan', tagline: 'Silence! Shooting chal rahi hai. Road band hai.', color: '#f72585' },
  kachra: { name: 'Kachra Ghat', tagline: 'Docks, containers aur "import-export" ka business', color: '#90be6d' },
  sarkari: { name: 'Sarkari Colony', tagline: 'Form bharo, stamp lagao, chai-paani do. Repeat.', color: '#e9c46a' },
};

export const TRUCK_BACKS: readonly string[] = ['HORN OK PLEASE', 'BURI NAZAR WALE TERA MUNH KALA', 'USE DIPPER AT NIGHT', 'MERA BHARAT MAHAAN', 'DRIVE SLOW, MUMMY WAITING'];

export const STUDIO_SIGNS: readonly string[] = ['STUDIO 7 · SILENCE!', 'SHOOTING IN PROGRESS', 'KHOON KA BADLA KHOON 3', 'RETAKE STUDIOS'];

export const STARTUP_LOGOS: readonly string[] = ['DisruptX', 'PivotPe', 'Chai.ai', 'BurnRate', 'Unicorn-ish', 'SynergyHub'];
