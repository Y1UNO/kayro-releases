//! « Exporter les logs » (Réglages › Général): one zip of the log folder, for the testers' feedback.
//! Local only: the file is written next to the scene exports and shown in Explorer, never sent.

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Writes `kayro-logs-<date>.zip` in `dest` (never over an earlier export: `-2`, `-3`… is
/// appended) with every `*.log` of `logs` and an `infos.txt` holding `infos`.
pub fn write_zip(logs: &Path, dest: &Path, date: &str, infos: &str) -> io::Result<PathBuf> {
    fs::create_dir_all(dest)?;
    let mut path = dest.join(format!("kayro-logs-{date}.zip"));
    for n in 2u32.. {
        if !path.exists() {
            break;
        }
        path = dest.join(format!("kayro-logs-{date}-{n}.zip"));
    }
    // Written aside then renamed: a failed export never leaves a broken zip behind.
    let partial = path.with_extension("zip.part");
    let result = fill(&partial, logs, infos).and_then(|()| fs::rename(&partial, &path));
    if result.is_err() {
        let _ = fs::remove_file(&partial);
    }
    result.map(|()| path)
}

fn fill(target: &Path, logs: &Path, infos: &str) -> io::Result<()> {
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let mut zip = ZipWriter::new(File::create(target)?);
    zip.start_file("infos.txt", options)?;
    zip.write_all(infos.as_bytes())?;
    let mut files: Vec<PathBuf> = match fs::read_dir(logs) {
        Ok(entries) => entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.is_file() && p.extension().is_some_and(|x| x == "log"))
            .collect(),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Vec::new(),
        Err(e) => return Err(e),
    };
    files.sort();
    for file in files {
        let Some(name) = file.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        // Today's file is still open by the logger: std opens it with shared read access.
        zip.start_file(name, options)?;
        let mut text = Vec::new();
        io::copy(&mut File::open(&file)?, &mut text)?;
        zip.write_all(redact(&String::from_utf8_lossy(&text), &profile()).as_bytes())?;
    }
    zip.finish()?.sync_all()
}

/// The user's own folder (`C:\Users\<name>`), as Windows gives it.
fn profile() -> String {
    std::env::var("USERPROFILE").unwrap_or_default()
}

/// Audit before 1.0: exported logs leave the PC (sent to a friend for help), so the user's folder
/// — and with it their Windows name — becomes `%USERPROFILE%`, whatever its case and slashes. Only
/// a whole folder name matches (`C:\Users\Tom` never eats into `C:\Users\Tommy`).
pub(crate) fn redact(text: &str, profile: &str) -> String {
    let norm = |s: &str| -> Vec<char> {
        s.chars()
            .map(|c| {
                if c == '/' {
                    '\\'
                } else {
                    c.to_ascii_lowercase()
                }
            })
            .collect()
    };
    let needle = norm(profile.trim_end_matches(['\\', '/']));
    if needle.len() < 4 {
        return text.to_string();
    }
    let chars: Vec<char> = text.chars().collect();
    let hay = norm(text);
    let mut out = String::with_capacity(text.len());
    let mut i = 0;
    while i < chars.len() {
        let end = i + needle.len();
        let hit = end <= hay.len()
            && hay[i..end] == needle[..]
            && hay
                .get(end)
                .is_none_or(|c| !c.is_alphanumeric() && !"_-.".contains(*c));
        if hit {
            out.push_str("%USERPROFILE%");
            i = end;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

/// Today's date (UTC) as `YYYY-MM-DD`, without a date crate.
pub fn today() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, m, d) = civil_from_days((secs / 86_400) as i64);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Days since 1970-01-01 → (year, month, day), Howard Hinnant's algorithm.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = yoe + era * 400 + i64::from(m <= 2);
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn civil_dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(19_782), (2024, 2, 29));
        assert_eq!(civil_from_days(20_755), (2026, 10, 29));
    }

    #[test]
    fn zips_only_the_logs_and_never_overwrites() {
        let tmp = tempfile::tempdir().unwrap();
        let logs = tmp.path().join("logs");
        fs::create_dir_all(&logs).unwrap();
        fs::write(logs.join("kayro.2026-10-28.log"), "hier").unwrap();
        fs::write(logs.join("kayro.2026-10-29.log"), "aujourd'hui").unwrap();
        fs::write(logs.join("notes.txt"), "pas un log").unwrap();
        let dest = tmp.path().join("exports");

        let first = write_zip(&logs, &dest, "2026-10-29", "Kayro 0.14.0").unwrap();
        let second = write_zip(&logs, &dest, "2026-10-29", "Kayro 0.14.0").unwrap();
        assert!(first.ends_with("kayro-logs-2026-10-29.zip"));
        assert!(second.ends_with("kayro-logs-2026-10-29-2.zip"));
        assert!(!dest.join("kayro-logs-2026-10-29.zip.part").exists());

        let mut zip = zip::ZipArchive::new(File::open(&first).unwrap()).unwrap();
        let names: Vec<String> = zip.file_names().map(|n| n.unwrap().into_owned()).collect();
        assert_eq!(names.len(), 3);
        assert!(!names.iter().any(|n| n == "notes.txt"));
        let mut today = String::new();
        zip.by_name("kayro.2026-10-29.log")
            .unwrap()
            .read_to_string(&mut today)
            .unwrap();
        assert_eq!(today, "aujourd'hui");
    }

    #[test]
    fn the_users_folder_is_masked_whatever_its_case_and_slashes() {
        let text = r"folder=c:\users\tom\appdata\discord\ link C:/Users/Tom/Desktop/x.lnk, C:\Users\Tommy, C:\Users\Tom";
        assert_eq!(
            redact(text, r"C:\Users\Tom"),
            r"folder=%USERPROFILE%\appdata\discord\ link %USERPROFILE%/Desktop/x.lnk, C:\Users\Tommy, %USERPROFILE%"
        );
        assert_eq!(redact("rien à masquer", ""), "rien à masquer");
        assert_eq!(
            redact(r"é C:\Users\Zoé\x", r"C:\Users\Zoé"),
            r"é %USERPROFILE%\x"
        );
    }

    #[test]
    fn a_missing_log_folder_still_gives_the_infos() {
        let tmp = tempfile::tempdir().unwrap();
        let path = write_zip(&tmp.path().join("absent"), tmp.path(), "2026-10-29", "x").unwrap();
        let zip = zip::ZipArchive::new(File::open(path).unwrap()).unwrap();
        assert_eq!(zip.len(), 1);
    }
}
