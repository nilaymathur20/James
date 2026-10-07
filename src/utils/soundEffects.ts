// Sound engine disabled to minimize slop and provide clean, quiet interaction
export const SoundEngine = {
  enabled: false,
  toggle() {
    return false;
  },
  initFromStorage() {},
  playSend() {},
  playReceiveChunk() {},
  playComplete() {},
  playClick() {},
  playDelete() {},
  playError() {},
};
