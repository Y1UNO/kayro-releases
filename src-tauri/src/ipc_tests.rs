use super::*;
use specta_typescript::Typescript;
use std::path::PathBuf;

fn committed_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/ipc/bindings.ts")
}

/// `src/ipc/bindings.ts` must be exactly what the Rust types generate (`npm run gen:types`).
#[test]
fn committed_bindings_match_the_rust_types() {
    let dir = tempfile::tempdir().unwrap();
    let fresh = dir.path().join("bindings.ts");
    builder()
        .export(Typescript::default(), &fresh)
        .expect("export");
    let norm = |p: &PathBuf| {
        std::fs::read_to_string(p)
            .unwrap_or_default()
            .replace("\r\n", "\n")
    };
    assert!(
        norm(&fresh) == norm(&committed_path()),
        "src/ipc/bindings.ts is out of date: run `npm run gen:types`"
    );
}
