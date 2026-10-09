fn main() {
    // Windows: one manifest (common controls v6, same content as Tauri's default) is embedded by
    // the linker in every executable: the app, `gen_types` and the unit tests. Tauri's own copy
    // only reaches the app binary, and test executables that link the Tauri runtime then fail to
    // start (STATUS_ENTRYPOINT_NOT_FOUND).
    let windows = std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows");
    let attributes = if windows {
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
    } else {
        tauri_build::Attributes::new()
    };
    tauri_build::try_build(attributes).expect("tauri build script failed");

    if windows {
        let manifest =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("windows-app.manifest");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    }
}
