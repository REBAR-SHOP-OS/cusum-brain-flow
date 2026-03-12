export interface EditorSettings {
  overlayPreset: string;
  transitionPreset: string;
  subtitlePreset: string;
  stickerPreset: string;
  textPreset: string;
  sfxVolume: number;
  mediaVolume: number;
}

export interface LogoSettings {
  posX: number;
  posY: number;
  zoom: number;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  overlayPreset: "None",
  transitionPreset: "None",
  subtitlePreset: "Standard",
  stickerPreset: "None",
  textPreset: "Minimal",
  sfxVolume: 80,
  mediaVolume: 100,
};

export const DEFAULT_LOGO_SETTINGS: LogoSettings = {
  posX: 90,
  posY: 5,
  zoom: 100,
};
