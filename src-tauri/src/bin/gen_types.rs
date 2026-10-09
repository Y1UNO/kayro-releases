//! `npm run gen:types`: writes `src/ipc/bindings.ts` from the Rust command and type definitions.

use std::path::Path;

fn main() {
    let out = Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/ipc/bindings.ts");
    hub_lib::ipc::builder()
        .export(specta_typescript::Typescript::default(), &out)
        .expect("could not export the TypeScript bindings");
    println!("wrote {}", out.display());
}
