//! Thin, safe wrappers over the Win32 calls the launcher and the process watcher need.
//! Everything `unsafe` for these two modules lives here, behind plain functions that tests
//! replace with fakes (see `launcher::Launcher` and `procwatch::ProcessSource`).

pub mod com;
pub mod icon;
pub mod island;
pub mod loopback;
pub mod media;
pub mod overlay;
pub mod own_window;
pub mod process;
pub mod shell;
pub mod startup;
pub mod theme;
pub mod top_windows;
pub mod veil;
pub mod window;

/// A failed Win32 call, reduced to its error code.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Win32Error(pub u32);

impl Win32Error {
    pub const FILE_NOT_FOUND: u32 = 2;
    pub const PATH_NOT_FOUND: u32 = 3;
    pub const ACCESS_DENIED: u32 = 5;
    pub const ELEVATION_REQUIRED: u32 = 740;
    pub const CANCELLED: u32 = 1223;

    /// `HRESULT_FROM_WIN32` codes (`0x8007xxxx`) are folded back to the plain Win32 code.
    pub fn from_hresult(hr: i32) -> Self {
        let raw = hr as u32;
        if raw >> 16 == 0x8007 {
            Self(raw & 0xFFFF)
        } else {
            Self(raw)
        }
    }

    pub fn last() -> Self {
        Self::from(windows::core::Error::from_thread())
    }
}

impl From<windows::core::Error> for Win32Error {
    fn from(e: windows::core::Error) -> Self {
        Self::from_hresult(e.code().0)
    }
}

impl std::fmt::Display for Win32Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Win32 error {}", self.0)
    }
}

/// UTF-16, NUL-terminated.
pub(crate) fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Puts the calling thread in Windows' background mode (lower CPU, disk and memory priority): for
/// work the user does not wait for, such as the palettes of step 14. Best effort.
pub fn background_thread() {
    use windows::Win32::System::Threading::{
        GetCurrentThread, SetThreadPriority, THREAD_MODE_BACKGROUND_BEGIN,
    };
    // SAFETY: the pseudo-handle of the current thread needs no closing.
    if let Err(e) = unsafe { SetThreadPriority(GetCurrentThread(), THREAD_MODE_BACKGROUND_BEGIN) } {
        tracing::debug!(error = %e, "could not lower the thread priority");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hresult_from_win32_is_folded() {
        assert_eq!(Win32Error::from_hresult(0x8007_0002_u32 as i32).0, 2);
        assert_eq!(Win32Error::from_hresult(0x8007_04C7_u32 as i32).0, 1223);
        // Not a Win32 facility: kept whole.
        assert_eq!(
            Win32Error::from_hresult(0x8000_4005_u32 as i32).0,
            0x8000_4005
        );
    }

    #[test]
    fn wide_is_nul_terminated() {
        assert_eq!(wide("ab"), vec![97, 98, 0]);
    }
}
