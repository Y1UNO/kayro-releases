//! Starting executables, shortcuts and protocol links.

use std::path::Path;

use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Threading::{
    CreateProcessW, GetProcessId, CREATE_UNICODE_ENVIRONMENT, PROCESS_INFORMATION, STARTUPINFOW,
};
use windows::Win32::UI::Shell::{
    ShellExecuteExW, SEE_MASK_FLAG_NO_UI, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS,
    SHELLEXECUTEINFOW,
};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

use super::com::ComGuard;
use super::{wide, Win32Error};

/// Quotes one argument following the `CommandLineToArgvW` rules (backslashes only matter
/// before a double quote).
pub fn quote_arg(arg: &str) -> String {
    if !arg.is_empty() && !arg.contains([' ', '\t', '"']) {
        return arg.to_string();
    }
    let mut out = String::from('"');
    let mut backslashes = 0usize;
    for c in arg.chars() {
        match c {
            '\\' => backslashes += 1,
            '"' => {
                out.extend(std::iter::repeat_n('\\', backslashes * 2 + 1));
                out.push('"');
                backslashes = 0;
            }
            _ => {
                out.extend(std::iter::repeat_n('\\', backslashes));
                out.push(c);
                backslashes = 0;
            }
        }
    }
    out.extend(std::iter::repeat_n('\\', backslashes * 2));
    out.push('"');
    out
}

/// `"exe" arg1 arg2…`
pub fn command_line(exe: &str, args: &[String]) -> String {
    std::iter::once(quote_arg(exe))
        .chain(args.iter().map(|a| quote_arg(a)))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Starts `path` directly (no shell, hence never an automatic elevation prompt: a program whose
/// manifest requires administrator rights fails with `ELEVATION_REQUIRED`). The working
/// directory defaults to the program's own folder.
pub fn create_process(path: &str, args: &[String], cwd: Option<&str>) -> Result<u32, Win32Error> {
    let dir = cwd.map(str::to_string).or_else(|| {
        let parent = Path::new(path).parent()?;
        // A missing folder must surface as «program not found», not «bad directory».
        parent.is_dir().then(|| parent.display().to_string())
    });
    let app = wide(path);
    let mut cmd = wide(&command_line(path, args));
    let dir_w = dir.as_deref().map(wide);
    let startup = STARTUPINFOW {
        cb: std::mem::size_of::<STARTUPINFOW>() as u32,
        ..Default::default()
    };
    let mut info = PROCESS_INFORMATION::default();
    // SAFETY: every buffer is NUL-terminated and alive during the call; `cmd` is mutable as the
    // API requires; the two returned handles are closed below.
    unsafe {
        CreateProcessW(
            PCWSTR(app.as_ptr()),
            Some(PWSTR(cmd.as_mut_ptr())),
            None,
            None,
            false,
            CREATE_UNICODE_ENVIRONMENT,
            None,
            dir_w
                .as_ref()
                .map_or(PCWSTR::null(), |d| PCWSTR(d.as_ptr())),
            &startup,
            &mut info,
        )?;
        let _ = CloseHandle(info.hThread);
        let _ = CloseHandle(info.hProcess);
    }
    Ok(info.dwProcessId)
}

/// `ShellExecuteExW`: files, shortcuts, protocol links, web addresses. `verb` is `Some("runas")`
/// for an elevated start (UAC prompt). Returns the process id when Windows reports one (not for
/// most links, which are handed to another process).
pub fn shell_execute(
    target: &str,
    args: &[String],
    cwd: Option<&str>,
    verb: Option<&str>,
) -> Result<Option<u32>, Win32Error> {
    let _com = ComGuard::init();
    let file = wide(target);
    let params = (!args.is_empty()).then(|| {
        wide(
            &args
                .iter()
                .map(|a| quote_arg(a))
                .collect::<Vec<_>>()
                .join(" "),
        )
    });
    let dir = cwd.map(wide);
    let verb_w = verb.map(wide);
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_FLAG_NO_UI | SEE_MASK_NOASYNC,
        lpVerb: verb_w
            .as_ref()
            .map_or(PCWSTR::null(), |v| PCWSTR(v.as_ptr())),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: params
            .as_ref()
            .map_or(PCWSTR::null(), |p| PCWSTR(p.as_ptr())),
        lpDirectory: dir.as_ref().map_or(PCWSTR::null(), |d| PCWSTR(d.as_ptr())),
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };
    // SAFETY: `info` is fully initialised, the strings outlive the call, and the process handle
    // it may return is closed right after reading the id.
    unsafe {
        ShellExecuteExW(&mut info)?;
        let handle: HANDLE = info.hProcess;
        if handle.is_invalid() {
            return Ok(None);
        }
        let pid = GetProcessId(handle);
        let _ = CloseHandle(handle);
        Ok((pid != 0).then_some(pid))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_arguments_stay_bare() {
        assert_eq!(quote_arg("abc"), "abc");
        assert_eq!(quote_arg("-flag=1"), "-flag=1");
    }

    #[test]
    fn spaces_empty_and_quotes_are_escaped() {
        assert_eq!(quote_arg(""), "\"\"");
        assert_eq!(quote_arg("a b"), "\"a b\"");
        assert_eq!(quote_arg(r#"say "hi""#), r#""say \"hi\"""#);
    }

    #[test]
    fn backslashes_double_only_before_a_quote() {
        assert_eq!(quote_arg(r"C:\a b\"), r#""C:\a b\\""#);
        assert_eq!(quote_arg(r#"a\"b"#), r#""a\\\"b""#);
        assert_eq!(quote_arg(r"C:\x"), r"C:\x");
    }

    #[test]
    fn command_line_quotes_the_program() {
        let line = command_line(r"C:\Program Files\a.exe", &["-x".into(), "b c".into()]);
        assert_eq!(line, r#""C:\Program Files\a.exe" -x "b c""#);
    }
}
