import type { AudioManager } from './AudioManager';

export function bindAudioSettingsUI(audioManager: AudioManager): void {
  const panel = document.getElementById('audio-settings');
  const master = document.getElementById('audio-master') as HTMLInputElement | null;
  const music = document.getElementById('audio-music') as HTMLInputElement | null;
  const sfx = document.getElementById('audio-sfx') as HTMLInputElement | null;
  const mute = document.getElementById('audio-mute') as HTMLButtonElement | null;
  const close = document.getElementById('audio-settings-close') as HTMLButtonElement | null;
  const open = document.getElementById('audio-settings-button') as HTMLButtonElement | null;

  if (!panel || !master || !music || !sfx || !mute || !open) return;

  const sync = (): void => {
    const settings = audioManager.getSettings();
    master.value = String(settings.masterVolume);
    music.value = String(settings.musicVolume);
    sfx.value = String(settings.sfxVolume);
    const percent = (value: number): string => Math.round(value * 100) + '%';
    const masterOutput = document.getElementById('audio-master-output');
    const musicOutput = document.getElementById('audio-music-output');
    const sfxOutput = document.getElementById('audio-sfx-output');
    if (masterOutput) masterOutput.textContent = percent(settings.masterVolume);
    if (musicOutput) musicOutput.textContent = percent(settings.musicVolume);
    if (sfxOutput) sfxOutput.textContent = percent(settings.sfxVolume);
    mute.textContent = settings.muted ? 'Muted' : 'Sound On';
    mute.setAttribute('aria-pressed', String(settings.muted));
  };

  open.onclick = () => {
    sync();
    panel.hidden = false;
  };

  close?.addEventListener('click', () => {
    panel.hidden = true;
  });

  panel.addEventListener('click', (event) => {
    if (event.target === panel) panel.hidden = true;
  });

  master.addEventListener('input', () => audioManager.setMasterVolume(Number(master.value)));
  music.addEventListener('input', () => audioManager.setMusicVolume(Number(music.value)));
  sfx.addEventListener('input', () => audioManager.setSfxVolume(Number(sfx.value)));
  mute.addEventListener('click', () => {
    audioManager.setMuted(!audioManager.getSettings().muted);
    sync();
  });

  sync();
}
