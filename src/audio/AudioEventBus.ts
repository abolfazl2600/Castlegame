import type { AudioEventDetail } from './types';

export const AUDIO_EVENT_NAME = 'castle-role:audio';

class AudioEventBus {
  private readonly target = new EventTarget();

  emit(detail: AudioEventDetail): void {
    this.target.dispatchEvent(new CustomEvent<AudioEventDetail>(AUDIO_EVENT_NAME, { detail }));
  }

  on(listener: (detail: AudioEventDetail) => void): () => void {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<AudioEventDetail>).detail;
      if (detail) listener(detail);
    };
    this.target.addEventListener(AUDIO_EVENT_NAME, handler);
    return () => this.target.removeEventListener(AUDIO_EVENT_NAME, handler);
  }
}

export const audioEvents = new AudioEventBus();
