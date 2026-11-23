// Offsets in seconds. Each syllable has an onset, duration and jaw amplitude.
// The clock can later be sourced from audio without changing the rig controls.
const phrases = [
  { duration: 3.2, syllables: [[.12,.22,.34],[.43,.30,.62],[.83,.16,.27],[1.10,.47,.88],[1.71,.23,.46],[2.03,.50,.73]],
    cues: [[0,0,0,0],[.36,0,0,0],[.78,3,0,-1],[1.22,3,0,-1],[1.54,3,2,-1],[1.78,3,0,-1],[2.14,0,0,0],[3.2,0,0,0]] },
  { duration: 3.7, syllables: [[.19,.29,.53],[.56,.17,.30],[.82,.43,.81],[1.40,.22,.54],[1.71,.34,.68],[2.38,.58,.91]],
    cues: [[0,0,0,0],[.47,0,0,0],[.93,-4,-1,1],[1.47,-4,-1,1],[1.82,-3,1,1],[2.10,-3,1,1],[2.62,0,2,0],[2.91,0,0,0],[3.7,0,0,0]] },
  { duration: 2.9, syllables: [[.10,.20,.46],[.39,.13,.30],[.60,.28,.63],[.99,.34,.78],[1.53,.21,.38],[1.84,.55,.94]],
    cues: [[0,0,0,0],[.50,0,0,0],[.89,2,1,1],[1.36,2,1,1],[1.70,-2,0,-1],[2.06,-2,0,-1],[2.40,0,0,0],[2.9,0,0,0]] }
];
const cycle = phrases.reduce((duration, phrase) => duration + phrase.duration, 0);
// Stage shifts lead the vocal accents, with short mechanical holds.
// Each cue is [time, torso yaw, torso roll, microphone elbow pitch].
const stageCues = [
  [0, 0, 0, 0], [.37, 0, 0, 0], [.92, .9, -.7, -.6],
  [1.36, .9, -.7, -.6], [1.63, .9, -.7, -2.1], [2.08, .9, -.7, -2.1],
  [2.66, 0, 0, 0], [3.47, 0, 0, 0], [4.08, -1.25, .7, -.9],
  [4.75, -1.25, .7, -.9], [5.23, -.8, .5, -2.7],
  [5.71, -.8, .5, -2.7], [6.33, 0, 0, 0], [7.32, 0, 0, 0],
  [7.92, .8, -.5, -1.2], [8.42, .8, -.5, -1.2],
  [9.12, 0, 0, 0], [cycle, 0, 0, 0]
];
// The gaze steps ahead of the head and holds between changes.
const gazeCues = [
  [0, 0, 0], [.31, 0, 0], [.50, 1.6, 0], [1.30, 1.6, 0],
  [1.51, .8, -.5], [2.04, .8, -.5], [2.26, 0, 0],
  [3.55, 0, 0], [3.75, -1.8, .4], [4.76, -1.8, .4],
  [5.06, -.9, 0], [5.70, -.9, 0], [5.93, 0, 0],
  [7.29, 0, 0], [7.47, 1.1, -.4], [7.99, 1.1, -.4],
  [8.19, -.9, 0], [8.72, -.9, 0], [8.95, 0, 0], [cycle, 0, 0]
];
// One compact lift and two wrist beats, then a return to the rest pose.
const waveCues = [
  [0, 0, 0, 0], [5.9, 0, 0, 0], [6.55, 29, 84, -6],
  [6.70, 29, 84, -6], [6.93, 29, 84, 8], [7.16, 29, 84, -8],
  [7.39, 29, 84, 7], [7.62, 29, 84, -6], [7.82, 29, 84, -6],
  [8.52, 0, 0, 0], [cycle, 0, 0, 0]
];

function ease(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function sampleCues(cues, time) {
  const next = cues.findIndex(([at]) => at > time);
  if (next < 1) return cues[0].slice(1);
  const [start, ...from] = cues[next - 1];
  const [end, ...to] = cues[next];
  const step = ease((time - start) / (end - start));
  return from.map((value, axis) => value + (to[axis] - value) * step);
}

export function sampleShowtime(seconds) {
  let time = seconds % cycle;
  const wave = sampleCues(waveCues, time);
  const [spineYaw, spineRoll, micPitch] = sampleCues(stageCues, time);
  const [eyeYaw, eyePitch] = sampleCues(gazeCues, time);
  let phrase = phrases[0];
  for (const candidate of phrases) {
    phrase = candidate;
    if (time < candidate.duration) break;
    time -= candidate.duration;
  }

  let jaw = 0;
  for (const [onset, duration, amplitude] of phrase.syllables) {
    const age = (time - onset) / duration;
    if (age < 0 || age >= 1) continue;
    // Quick attack, a short actuator hold, then a slower release.
    jaw = amplitude * ease(age / .23) * ease((1 - age) / .39);
    break;
  }

  const [yaw, pitch, roll] = sampleCues(phrase.cues, time);
  return { jaw, yaw, pitch, roll, wave, spineYaw, spineRoll, micPitch, eyeYaw, eyePitch };
}
