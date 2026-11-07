//! Typed shape of the small documents: settings, slots, and the shared (strict) files
//! scenes and themes. Apps live in `apps.rs`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

pub use super::game_colors::{
    ColorCharacter, ColorIntensity, ColorPassage, ColorPick, ColorTrigger,
};
use super::migrate::{current_version, Migration};
pub use super::scene::SceneFile;
pub use super::sounds::SoundPack;
use super::sounds::SOUND_VOLUME_DEFAULT;
use super::store::{lenient_merge, Document, LoadReport};
pub use super::theme_file::{is_theme_colour, ThemeFile};
use super::validate::validate_settings;
use super::visual::{settings_v1_to_v2, settings_v2_to_v3, DEFAULT_THEME};
pub use super::visual::{
    CardFloat, CardHoverStyle, Elasticity, IslandPassage, KeyboardLayout, MotionStyle, MusicColors,
    MusicQuality, OpeningScreen, OpeningStyle, StartupAfter, StartupOpen, ThemeTransition,
    WidgetUnroll,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    /// « Auto » (step 24): high, lowered rung by rung while frames are missed (src/fx/autoQuality.ts),
    /// and the engine's own fallback. The default since 0.22 (new installs; a saved choice stays).
    #[default]
    Auto,
    Eco,
    Balanced,
    High,
    Ultra,
}

/// How much the colours of the selected game tint the interface (DESIGN.md).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum ColorMode {
    Off,
    /// « Stylisé » (30/10): the ambience and the accents take the game's colours. The immersive
    /// mode was removed that day: an older file's `immersive` reads as this one.
    #[default]
    #[serde(alias = "immersive")]
    Light,
}

/// How the hub is shown: a borderless window the size of the chosen screen, or a normal window
/// (ARCHITECTURE.md §4). The widget mode went on 2026-10-31: the island (Kysland) is there
/// whenever Kayro is not (`island_always`), so an older file's `widget` reads as immersive.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DisplayMode {
    #[default]
    #[serde(alias = "widget")]
    Immersive,
    Window,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub schema_version: u32,
    pub theme_id: String,
    pub quality: Quality,
    pub color_mode: ColorMode,
    pub hotkey: String,
    /// « Écrire dans Kysland » (2026-11-04): opens the island with the cursor in its search
    /// (Kayro's search when Kayro is on screen); empty: no such shortcut.
    pub search_hotkey: String,
    /// « Disposition du clavier » (2026-11-04): how the recorder names a pressed key.
    pub keyboard_layout: KeyboardLayout,
    pub language: String,
    /// Strength of the animated atmosphere (fog, light, dust), 0.3–1.3 (« Atmosphère »).
    pub atmosphere_intensity: f32,
    pub display_mode: DisplayMode,
    /// « Kysland toujours à l'écran » (Raccourcis clavier): the island shows whenever Kayro is not.
    pub island_always: bool,
    /// « Cacher l'île » (2026-11-02): docked and left alone, the island goes into the top edge
    /// after `island_tuck_delay` s; the cursor held on the very top of its place for
    /// `island_peek_delay` s brings it out.
    pub island_tuck: bool,
    pub island_tuck_delay: f32,
    pub island_peek_delay: f32,
    /// « Mode musique » (the opened island's switch, 2026-11-02): while music plays, the island
    /// becomes a disc in the middle of its screen (the ink scene went on 2026-11-03).
    pub island_music: bool,
    /// Its settings (Visuel › Mode musique; bounds and meaning in visual.rs), « Avancé » from the
    /// sensitivities (higher: more hits) on; `music_demo`: the test track instead of the sound.
    pub music_bass: f32,
    pub music_crash: f32,
    pub music_trails: f32,
    pub music_gloss: f32,
    pub music_sense_kick: f32,
    pub music_sense_snare: f32,
    pub music_sense_hat: f32,
    pub music_sense_crash: f32,
    pub music_delay_ms: f32,
    pub music_quality: MusicQuality,
    pub music_demo: bool,
    pub music_colors: MusicColors,
    /// Escape hides the hub once there is nothing left to close.
    pub hide_on_escape: bool,
    /// Losing the focus hides the hub (the widget only folds its panel).
    pub hide_on_blur: bool,
    /// « Mode économe »: the window is destroyed while hidden (less memory, slower to come back).
    pub economy_mode: bool,
    pub motion_style: MotionStyle,
    /// Follow Windows « Effets d'animation » (reduce motion); off = Kayro ignores it.
    pub follow_system_motion: bool,
    pub card_float: CardFloat,
    pub opening_style: OpeningStyle,
    pub theme_transition: ThemeTransition,
    pub opening_screen: OpeningScreen,
    pub widget_unroll: WidgetUnroll,
    pub widget_spring: Elasticity,
    /// Step 20: « Passage de Kysland » (from one screen to another).
    pub island_passage: IslandPassage,
    pub card_hover: CardHoverStyle,
    pub bokeh: bool,
    pub particles: bool,
    pub cursor_light: bool,
    /// Game colours (step 14, « Personnalisation avancée »): V1, V6, V5, V7, V8.
    pub color_intensity: ColorIntensity,
    pub color_character: ColorCharacter,
    pub color_pick: ColorPick,
    pub color_passage: ColorPassage,
    pub color_trigger: ColorTrigger,
    /// An app without a picture takes its icon's colours (V10 b); off = the theme's.
    pub color_from_icon: bool,
    /// Step 17b, Réglages › Sons: on, style, volume (0–1), and the three families.
    pub sounds_on: bool,
    pub sound_pack: SoundPack,
    pub sound_volume: f32,
    pub sound_interface: bool,
    pub sound_transitions: bool,
    pub sound_launch: bool,
    /// Step 18b: one look for an update at start (network: off unless the user allows it).
    pub update_auto: bool,
    /// Step 19: started with Windows, the hub opens on its home screen (still logo) instead of
    /// waiting in the notification area.
    pub startup_home: bool,
    /// « Au démarrage » and « Après l'intro » (they replace `startup_home`, migrated v2 → v3).
    pub startup_open: StartupOpen,
    pub startup_after: StartupAfter,
    /// Step 19b: detected apps the user chose to ignore (their ids), hidden from the next scans.
    pub ignored_detections: Vec<String>,
}

/// Bounds of [`Settings::atmosphere_intensity`].
pub const ATMOSPHERE_MIN: f32 = 0.3;
pub const ATMOSPHERE_MAX: f32 = 1.3;
/// « Normale »: the validated look.
pub const ATMOSPHERE_DEFAULT: f32 = 1.0;
/// « Cacher l'île »: its delays (seconds), in notches of the settings' sliders.
pub const TUCK_DELAY_MAX: f32 = 3.0;
pub const TUCK_DELAY_DEFAULT: f32 = 1.5;
pub const PEEK_DELAY_MAX: f32 = 1.0;
pub const PEEK_DELAY_DEFAULT: f32 = 0.1;

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: current_version(SETTINGS_MIGRATIONS),
            theme_id: DEFAULT_THEME.into(),
            quality: Quality::default(),
            color_mode: ColorMode::default(),
            hotkey: "Ctrl+Alt+H".into(),
            search_hotkey: "Ctrl+Alt+K".into(),
            keyboard_layout: KeyboardLayout::default(),
            language: "fr".into(),
            atmosphere_intensity: ATMOSPHERE_DEFAULT,
            display_mode: DisplayMode::default(),
            island_always: true,
            island_tuck: false,
            island_tuck_delay: TUCK_DELAY_DEFAULT,
            island_peek_delay: PEEK_DELAY_DEFAULT,
            island_music: false,
            music_bass: 1.0,
            music_crash: 1.0,
            music_trails: 0.6,
            // The player's ink matte, as black as the island (2026-11-03).
            music_gloss: 0.0,
            music_sense_kick: 1.0,
            music_sense_snare: 1.0,
            music_sense_hat: 1.0,
            music_sense_crash: 1.0,
            music_delay_ms: 0.0,
            music_quality: MusicQuality::default(),
            music_demo: false,
            music_colors: MusicColors::default(),
            hide_on_escape: true,
            hide_on_blur: false,
            economy_mode: false,
            motion_style: MotionStyle::default(),
            follow_system_motion: true,
            card_float: CardFloat::default(),
            opening_style: OpeningStyle::default(),
            theme_transition: ThemeTransition::default(),
            opening_screen: OpeningScreen::default(),
            widget_unroll: WidgetUnroll::default(),
            island_passage: IslandPassage::default(),
            widget_spring: Elasticity::default(),
            card_hover: CardHoverStyle::default(),
            bokeh: true,
            particles: true,
            cursor_light: true,
            color_intensity: ColorIntensity::default(),
            color_character: ColorCharacter::default(),
            color_pick: ColorPick::default(),
            color_passage: ColorPassage::default(),
            color_trigger: ColorTrigger::default(),
            color_from_icon: true,
            sounds_on: true,
            sound_pack: SoundPack::default(),
            sound_volume: SOUND_VOLUME_DEFAULT,
            sound_interface: true,
            sound_transitions: true,
            sound_launch: true,
            update_auto: false,
            startup_home: false,
            startup_open: StartupOpen::default(),
            startup_after: StartupAfter::default(),
            ignored_detections: Vec::new(),
        }
    }
}

/// Partial update: absent (or null) fields are left as they are.
#[derive(Debug, Clone, Default, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct SettingsPatch {
    pub theme_id: Option<String>,
    pub quality: Option<Quality>,
    pub color_mode: Option<ColorMode>,
    pub hotkey: Option<String>,
    pub search_hotkey: Option<String>,
    pub keyboard_layout: Option<KeyboardLayout>,
    pub language: Option<String>,
    pub atmosphere_intensity: Option<f32>,
    pub display_mode: Option<DisplayMode>,
    pub island_always: Option<bool>,
    pub island_tuck: Option<bool>,
    pub island_tuck_delay: Option<f32>,
    pub island_peek_delay: Option<f32>,
    pub island_music: Option<bool>,
    pub music_bass: Option<f32>,
    pub music_crash: Option<f32>,
    pub music_trails: Option<f32>,
    pub music_gloss: Option<f32>,
    pub music_sense_kick: Option<f32>,
    pub music_sense_snare: Option<f32>,
    pub music_sense_hat: Option<f32>,
    pub music_sense_crash: Option<f32>,
    pub music_delay_ms: Option<f32>,
    pub music_quality: Option<MusicQuality>,
    pub music_demo: Option<bool>,
    pub music_colors: Option<MusicColors>,
    pub hide_on_escape: Option<bool>,
    pub hide_on_blur: Option<bool>,
    pub economy_mode: Option<bool>,
    pub motion_style: Option<MotionStyle>,
    pub follow_system_motion: Option<bool>,
    pub card_float: Option<CardFloat>,
    pub opening_style: Option<OpeningStyle>,
    pub theme_transition: Option<ThemeTransition>,
    pub opening_screen: Option<OpeningScreen>,
    pub widget_unroll: Option<WidgetUnroll>,
    pub widget_spring: Option<Elasticity>,
    pub island_passage: Option<IslandPassage>,
    pub card_hover: Option<CardHoverStyle>,
    pub bokeh: Option<bool>,
    pub particles: Option<bool>,
    pub cursor_light: Option<bool>,
    pub color_intensity: Option<ColorIntensity>,
    pub color_character: Option<ColorCharacter>,
    pub color_pick: Option<ColorPick>,
    pub color_passage: Option<ColorPassage>,
    pub color_trigger: Option<ColorTrigger>,
    pub color_from_icon: Option<bool>,
    pub sounds_on: Option<bool>,
    pub sound_pack: Option<SoundPack>,
    pub sound_volume: Option<f32>,
    pub sound_interface: Option<bool>,
    pub sound_transitions: Option<bool>,
    pub sound_launch: Option<bool>,
    pub update_auto: Option<bool>,
    pub startup_home: Option<bool>,
    pub startup_open: Option<StartupOpen>,
    pub startup_after: Option<StartupAfter>,
    pub ignored_detections: Option<Vec<String>>,
}

impl Settings {
    pub fn apply(&mut self, patch: SettingsPatch) {
        macro_rules! take {
            ($($field:ident),* $(,)?) => {
                $(if let Some(v) = patch.$field {
                    self.$field = v;
                })*
            };
        }
        take!(
            theme_id,
            quality,
            color_mode,
            hotkey,
            search_hotkey,
            keyboard_layout,
            language,
            atmosphere_intensity,
            display_mode,
            island_always,
            island_tuck,
            island_tuck_delay,
            island_peek_delay,
            island_music,
            music_bass,
            music_crash,
            music_trails,
            music_gloss,
            music_sense_kick,
            music_sense_snare,
            music_sense_hat,
            music_sense_crash,
            music_delay_ms,
            music_quality,
            music_demo,
            music_colors,
            hide_on_escape,
            hide_on_blur,
            economy_mode,
            motion_style,
            follow_system_motion,
            card_float,
            opening_style,
            theme_transition,
            opening_screen,
            widget_unroll,
            widget_spring,
            island_passage,
            card_hover,
            bokeh,
            particles,
            cursor_light,
            color_intensity,
            color_character,
            color_pick,
            color_passage,
            color_trigger,
            color_from_icon,
            sounds_on,
            sound_pack,
            sound_volume,
            sound_interface,
            sound_transitions,
            sound_launch,
            update_auto,
            startup_home,
            startup_open,
            startup_after,
            ignored_detections,
        );
        self.clamp_music();
    }
}

/// v1 → v2 (R5): Mauve became Encre, the five pre-logo themes fall back to Bleu-gris.
pub const SETTINGS_MIGRATIONS: &[Migration] = &[settings_v1_to_v2, settings_v2_to_v3];

impl Document for Settings {
    const NAME: &'static str = "settings.json";
    const MIGRATIONS: &'static [Migration] = SETTINGS_MIGRATIONS;
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String> {
        Ok(lenient_merge(value, report, |s: &Settings| {
            validate_settings(s).map_err(|e| e.to_string())
        }))
    }
}

/// Slot name → app id. Shared scenes only ever mention slot names, never paths or commands.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SlotsFile {
    pub schema_version: u32,
    pub slots: BTreeMap<String, String>,
}

impl Default for SlotsFile {
    fn default() -> Self {
        Self {
            schema_version: 1,
            slots: BTreeMap::new(),
        }
    }
}

impl Document for SlotsFile {
    const NAME: &'static str = "slots.json";
    fn from_value(value: Value, report: &mut LoadReport) -> Result<Self, String> {
        Ok(lenient_merge(value, report, |_: &SlotsFile| Ok(())))
    }
}

/// Shared / imported files are strict: any unknown field rejects the whole file.
pub trait StrictFile: serde::de::DeserializeOwned {
    fn check(&self) -> Result<(), String>;
}
