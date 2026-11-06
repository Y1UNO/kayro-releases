//! A child process that ends with Kayro (step 21, the voice's brain): it is put in a job object
//! that kills it when Kayro's handle to the job closes, even when Kayro crashes.

use std::os::windows::io::AsRawHandle;

use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

pub struct Job(HANDLE);

// SAFETY: a job handle may be used and closed from any thread.
unsafe impl Send for Job {}
unsafe impl Sync for Job {}

impl Job {
    /// A job holding `child`; `None` when Windows refuses (the child then lives on its own, and
    /// Kayro still ends it when it quits normally).
    pub fn holding(child: &std::process::Child) -> Option<Self> {
        // SAFETY: the job handle is closed on every failure path, the information struct lives
        // through the call, and the child's handle stays valid while `child` exists.
        unsafe {
            let job = CreateJobObjectW(None, PCWSTR::null()).ok()?;
            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let held = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const core::ffi::c_void,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .is_ok()
                && AssignProcessToJobObject(job, HANDLE(child.as_raw_handle())).is_ok();
            if !held {
                let _ = CloseHandle(job);
                return None;
            }
            Some(Self(job))
        }
    }
}

impl Drop for Job {
    fn drop(&mut self) {
        // SAFETY: the handle came from CreateJobObjectW and is closed once; closing it kills
        // what the job holds.
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
