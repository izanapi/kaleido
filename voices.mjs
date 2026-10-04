// One catalog feeds synthesis, the voice picker and dice randomization.
export const VOICES = {
  celesta: { name: 'Celesta', attack:.001, length:1.15, gain:.19, partials:[[1,.75,1],[3,.17,.4],[5.04,.1,.2]] },
  cimbalom: { name: 'Cimbalom', attack:.001, length:1.25, gain:.19, partials:[[1,.6,1],[1.003,.28,.8],[3.01,.2,.35]] },
  harpsichord: { name: 'Harpsichord', attack:.001, length:.62, gain:.16, partials:[[1,.56,1,'sawtooth'],[2,.18,.45],[4,.09,.22]] },
  psaltery: { name: 'Psaltery', attack:.002, length:1.35, gain:.18, partials:[[1,.65,1,'triangle'],[2.002,.24,.65],[3,.15,.35]] },
  frost: { name: 'Frost bells', attack:.009, length:1.7, gain:.16, partials:[[1,.7,1],[2.756,.2,.65],[5.404,.09,.25]] },
  cathedral: { name: 'Cathedral', attack:.06, length:1.55, gain:.17, partials:[[1,.6,1],[2,.3,.9],[3,.18,.8]] },
  chime: { name: 'Gothic chime', attack:.002, length:1.6, gain:.18, partials:[[1,.65,1],[1.498,.3,.75],[2.01,.2,.5]] },
  auroraFM: { name: 'Aurora FM', attack:.018, length:1.1, gain:.18, fm:[2,2.6,.55] },

  kaleido: { name: 'Kaleido', attack: .006, length: 1.35, gain: .18 },
  alloy: { name: 'Alloy', attack: .001, length: 1.15, gain: .21, partials: [[1,.67,1],[1.414,.23,.65],[2.76,.16,.43],[4.09,.07,.2]] },
  tine: { name: 'Tines', attack: .001, length: 1.4, gain: .22, partials: [[1,.74,1],[2.01,.12,.7],[5.43,.15,.25],[9.1,.035,.12]] },
  chrome: { name: 'Chrome FM', attack: .002, length: .9, gain: .20, fm: [3.5,4.2,.18] },
  ion: { name: 'Ion FM', attack: .002, length: .75, gain: .20, fm: [1.414,6.5,.35] },
  bell: { name: 'Microbell', attack: .001, length: 1.65, gain: .19, partials: [[1,.7,1],[2.4,.23,.7],[3.96,.11,.38],[5.8,.06,.16]] },
  wire: { name: 'Wire', attack: .001, length: .7, gain: .18, partials: [[1,.5,1],[1.003,.23,.8],[3,.16,.5],[7.07,.13,.25]] },
  dust: { name: 'Metal dust', attack: .001, length: .3, gain: .22, partials: [[1,.23,.8],[2.73,.4,.65],[4.91,.28,.45],[7.13,.19,.3]] },
  kalimba: { name: 'Kalimba', attack: .003, length: 1, gain: .18 },
  koto: { name: 'Koto', attack: .0015, length: .85, gain: .23 },
  bamboo: { name: 'Bamboo', attack: .07, length: 1.15, gain: .20 },
  glass: { name: 'Glass', attack: .002, length: 1.45, gain: .17 },
  neon: { name: 'Neon FM', attack: .004, length: .85, gain: .17 },
  velvet: { name: 'Velvet', attack: .012, length: 1, gain: .17 },
  orbit: { name: 'Orbit', attack: .32, length: 1.8, gain: .16 },
  chip: { name: 'Chip', attack: .001, length: .28, gain: .10 },
};

// The instrument intentionally foregrounds electronic and metallic colors.
export const KALEIDO_VOICES = ['kaleido','celesta','cimbalom','harpsichord','psaltery','frost','cathedral','chime','auroraFM','alloy','tine','chrome','ion','bell','glass','wire','dust','neon','chip'];

// Fractional-delay Karplus–Strong excitation, with a half-sample compensation
// for the averaging filter. This is a synthesized plucked-string voice.
export function pluckedWave(sampleRate, frequency, duration, brightness, random = Math.random) {
  const result = new Float32Array(Math.ceil(sampleRate * duration));
  if (frequency >= sampleRate * .48) return result;
  if (frequency > sampleRate / 5) {
    // At very high pitches the delay loop is too short: use a stable tuned tail.
    for (let i = 0; i < result.length; i++) result[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * Math.exp(-i / sampleRate * 4) * .7;
    return result;
  }
  const delay = sampleRate / frequency - .5;
  const size = Math.ceil(delay) + 2, ring = new Float32Array(size);
  let mean = 0;
  for (let i = 0; i < size; i++) { ring[i] = random() * 2 - 1; mean += ring[i] / size; }
  for (let i = 0; i < size; i++) ring[i] -= mean;
  const feedback = .992 + Math.max(0, Math.min(1, brightness)) * .006;
  const read = position => {
    const wrapped = ((position % size) + size) % size;
    const index = Math.floor(wrapped), fraction = wrapped - index;
    return ring[index] * (1 - fraction) + ring[(index + 1) % size] * fraction;
  };
  let peak = .001;
  for (let i = 0; i < result.length; i++) {
    const value = (read(i - delay) + read(i - delay - 1)) * .5 * feedback;
    ring[i % size] = value; result[i] = value; peak = Math.max(peak, Math.abs(value));
  }
  const gain = .8 / peak;
  for (let i = 0; i < result.length; i++) result[i] *= gain;
  return result;
}
