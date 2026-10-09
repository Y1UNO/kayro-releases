fn main() {
    // Same effect as a `requireAdministrator` manifest: Windows asks for elevation at start.
    println!("cargo:rustc-link-arg-bins=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg-bins=/MANIFESTUAC:level='requireAdministrator' uiAccess='false'");
}
