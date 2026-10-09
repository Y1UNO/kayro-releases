//! COM-based launch of packaged (UWP / Store) apps.

use windows::core::PCWSTR;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_LOCAL_SERVER, COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Shell::{
    ApplicationActivationManager, IApplicationActivationManager, AO_NONE,
};

use super::{wide, Win32Error};

/// Keeps COM initialised on the current thread for as long as it lives.
pub(crate) struct ComGuard(bool);

impl ComGuard {
    pub fn init() -> Self {
        // SAFETY: plain initialisation call; balanced by `CoUninitialize` in `Drop` when it
        // succeeded (S_OK and S_FALSE both count; a mode mismatch means COM is already usable).
        let hr = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
        Self(hr.is_ok())
    }
}

impl Drop for ComGuard {
    fn drop(&mut self) {
        if self.0 {
            // SAFETY: only reached after a successful `CoInitializeEx` on this thread.
            unsafe { CoUninitialize() };
        }
    }
}

/// Starts a packaged app by its AUMID (`PackageFamilyName!AppId`) and returns its process id.
pub fn activate_uwp(aumid: &str) -> Result<u32, Win32Error> {
    let _com = ComGuard::init();
    let id = wide(aumid);
    // SAFETY: `id` is NUL-terminated and outlives the call; the interface is released on drop.
    unsafe {
        let manager: IApplicationActivationManager =
            CoCreateInstance(&ApplicationActivationManager, None, CLSCTX_LOCAL_SERVER)?;
        Ok(manager.ActivateApplication(PCWSTR(id.as_ptr()), PCWSTR::null(), AO_NONE)?)
    }
}
