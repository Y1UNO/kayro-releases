use std::path::PathBuf;
use std::{env, fs};

fn main() {
    // The NSIS installer to carry, given by scripts/build-installer.ps1. Without it the installer
    // still builds (tests, clippy) and only knows it has nothing to install.
    println!("cargo:rerun-if-env-changed=KAYRO_PAYLOAD");
    let out = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("payload.bin");
    match env::var("KAYRO_PAYLOAD") {
        Ok(path) if !path.is_empty() => {
            println!("cargo:rerun-if-changed={path}");
            fs::copy(&path, &out).expect("KAYRO_PAYLOAD : installeur NSIS introuvable");
        }
        _ => fs::write(&out, []).expect("payload vide"),
    }
    // The window's page is built by Vite (installer/vite.config.ts); a placeholder lets the crate
    // compile before that.
    let dist = PathBuf::from("dist");
    if !dist.join("index.html").exists() {
        fs::create_dir_all(&dist).expect("dist");
        fs::write(dist.join("index.html"), "<!doctype html><title>Kayro</title>")
            .expect("page provisoire");
    }
    tauri_build::build()
}
