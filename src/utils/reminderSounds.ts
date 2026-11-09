/** Four original, short notification chimes synthesized on demand. No audio files or external calls. */
export type ReminderTone = 1 | 2 | 3 | 4;
const sequences: Record<ReminderTone, Array<[number, number]>> = {
  1: [[784, 0], [1047, .19]],
  2: [[523, 0], [659, .17], [784, .34]],
  3: [[659, 0], [523, .2], [659, .4], [880, .6]],
  4: [[440, 0], [587, .22], [740, .44], [988, .66]],
};
let ctx: AudioContext | null = null;
export async function playReminderTone(tone: number): Promise<void> {
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) throw new Error('audio_unavailable');
  if (!ctx) ctx = new AudioContextCtor();
  if (ctx.state === 'suspended') await ctx.resume();
  const sequence = sequences[tone as ReminderTone] || sequences[1];
  const start = ctx.currentTime + .03;
  sequence.forEach(([hz, offset]) => {
    const osc = ctx!.createOscillator();
    const volume = ctx!.createGain();
    osc.type = tone === 3 ? 'triangle' : tone === 4 ? 'sine' : 'sine';
    osc.frequency.setValueAtTime(hz, start + offset);
    volume.gain.setValueAtTime(.0001, start + offset);
    volume.gain.exponentialRampToValueAtTime(.13, start + offset + .02);
    volume.gain.exponentialRampToValueAtTime(.0001, start + offset + .28);
    osc.connect(volume);
    volume.connect(ctx!.destination);
    osc.start(start + offset);
    osc.stop(start + offset + .3);
  });
}
