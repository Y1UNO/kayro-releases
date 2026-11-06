//! « Démarrer avec Windows » as a task of the Task Scheduler, started at the user's logon
//! (2026-10-31). The `Run` key Windows reads last: on the test PC Kayro started 24 to 57 s after
//! the logon; a logon task starts within seconds. The task is the user's own (no administrator
//! rights), runs with their normal rights, never on a timer, never stopped after a while, on
//! battery too, at normal priority (a task's default is below normal).

use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Command, Output};

/// No console window for `schtasks.exe`.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn schtasks(args: &[&str]) -> std::io::Result<Output> {
    Command::new("schtasks.exe")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// The task's definition: `exe args` at `user`'s logon.
pub fn task_xml(user: &str, exe: &str, args: &str) -> String {
    let (user, exe, args) = (escape(user), escape(exe), escape(args));
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Kayro au démarrage de Windows</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>{user}</UserId></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>{user}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>4</Priority>
  </Settings>
  <Actions Context="Author"><Exec><Command>{exe}</Command><Arguments>{args}</Arguments></Exec></Actions>
</Task>
"#
    )
}

/// The user the task runs for (`DOMAIN\name`).
fn user() -> Result<String, String> {
    let name = std::env::var("USERNAME").map_err(|_| "no user name".to_string())?;
    Ok(match std::env::var("USERDOMAIN") {
        Ok(domain) if !domain.is_empty() => format!("{domain}\\{name}"),
        _ => name,
    })
}

/// The task's definition as Windows keeps it, None when there is no such task.
pub fn query(name: &str) -> Option<String> {
    let out = schtasks(&["/Query", "/TN", name, "/XML"]).ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Whether the task `name` starts `exe` (case ignored).
pub fn starts(definition: &str, exe: &Path) -> bool {
    let exe = escape(&exe.to_string_lossy()).to_lowercase();
    definition.to_lowercase().contains(&exe)
}

/// Creates (or replaces) the task `name`: `exe args` at the user's logon.
pub fn create(name: &str, exe: &Path, args: &str) -> Result<(), String> {
    let xml = task_xml(&user()?, &exe.to_string_lossy(), args);
    // The Task Scheduler reads a UTF-16 file (with its byte order mark).
    let mut bytes = vec![0xFF, 0xFE];
    bytes.extend(xml.encode_utf16().flat_map(u16::to_le_bytes));
    let file = std::env::temp_dir().join(format!("kayro-task-{}.xml", std::process::id()));
    std::fs::write(&file, bytes).map_err(|e| e.to_string())?;
    let path = file.to_string_lossy().into_owned();
    let out = schtasks(&["/Create", "/TN", name, "/XML", &path, "/F"]);
    let _ = std::fs::remove_file(&file);
    let out = out.map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Removes the task `name` (nothing when there is none).
pub fn delete(name: &str) -> Result<(), String> {
    if query(name).is_none() {
        return Ok(());
    }
    let out = schtasks(&["/Delete", "/TN", name, "/F"]).map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_task_starts_this_exe_silently_at_the_users_logon_and_is_never_stopped() {
        let xml = task_xml(r"PC\Tom", r"C:\Jeux & co\Kayro.exe", "--silent");
        assert!(xml.contains(r"<UserId>PC\Tom</UserId></LogonTrigger>"));
        assert!(xml.contains(r"<Command>C:\Jeux &amp; co\Kayro.exe</Command>"));
        assert!(xml.contains("<Arguments>--silent</Arguments>"));
        assert!(xml.contains("<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>"));
        assert!(xml.contains("<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>"));
        assert!(xml.contains("<RunLevel>LeastPrivilege</RunLevel>"));
    }

    #[test]
    fn a_task_for_another_exe_is_seen() {
        let xml = task_xml(r"PC\Tom", r"C:\HUB\target\release\Kayro.exe", "--silent");
        assert!(starts(&xml, Path::new(r"c:\hub\target\release\kayro.exe")));
        assert!(!starts(&xml, Path::new(r"C:\HUB\target\debug\Kayro.exe")));
    }
}
