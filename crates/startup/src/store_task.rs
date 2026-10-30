//! Store apps: they start with Windows through a `StartupTask` of their package, not the `Run` key.
//! Their switch is the one of Paramètres › Applications › Démarrage: a `State` value per task, the
//! `StartupTaskState` of the WinRT API (documented: 0 off, 1 off by the user, 2 on, 3 off by
//! policy, 4 on by policy). Where Windows keeps it (`…\AppModel\SystemAppData\<package>\<task>`)
//! is not documented; « off by the user » is what Windows' own switch writes, and an app cannot
//! switch itself back on after it.
//!
//! The mark of such an entry is that value as 4 bytes (little-endian DWORD); its name is
//! `<package family>\<task>`.

/// « On » (Enabled).
pub const ON: [u8; 4] = [2, 0, 0, 0];
/// « Off by the user » (DisabledByUser).
pub const OFF: [u8; 4] = [1, 0, 0, 0];

fn state(mark: Option<&[u8]>) -> u32 {
    match mark {
        Some([a, b, c, d, ..]) => u32::from_le_bytes([*a, *b, *c, *d]),
        _ => 0,
    }
}

pub fn is_on(mark: Option<&[u8]>) -> bool {
    matches!(state(mark), 2 | 4)
}

/// Set by a policy (the PC's administrator): never changed here.
pub fn by_policy(mark: Option<&[u8]>) -> bool {
    matches!(state(mark), 3 | 4)
}

/// `5319275A.WhatsAppDesktop_cv1g1gvanyjgm\…` → `WhatsAppDesktop`.
pub fn display_name(name: &str) -> String {
    let package = name.split('\\').next().unwrap_or(name);
    let family = package.split('_').next().unwrap_or(package);
    family.rsplit('.').next().unwrap_or(family).to_string()
}

/// Windows' own packages (« Lien avec mobile », widgets…); not `Microsoft.WindowsTerminal`.
pub fn is_windows(name: &str) -> bool {
    let n = name.to_lowercase();
    n.starts_with("microsoftwindows.") || n.starts_with("microsoft.windows.")
}
