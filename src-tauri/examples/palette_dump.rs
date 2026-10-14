//! Step 14 dev tool: prints, as JSON, the local images of Steam games (read in place from Steam's
//! cache, nothing copied) and the palettes Kayro takes from them; also the palette of any image
//! file. Feeds the step-14 boards and manual checks. Read-only.
//! `cargo run -q -p hub --release --example palette_dump -- steam:1145350 file:C:\path\icon.png`

use hub_lib::art::{locate, palette, ArtRole, ArtRoots};
use serde_json::{json, Map, Value};

fn image(path: &std::path::Path, low_res: bool, with_palette: bool) -> Value {
    let palette = with_palette
        .then(|| std::fs::read(path).ok())
        .flatten()
        .and_then(|bytes| palette::extract(&bytes).ok());
    json!({ "path": path, "lowRes": low_res, "palette": palette })
}

fn main() {
    let roots = ArtRoots::system(std::env::temp_dir().join("kayro-no-user-art"));
    let mut out = Vec::new();
    for arg in std::env::args().skip(1) {
        let mut images = Map::new();
        if let Some(id) = arg.strip_prefix("steam:") {
            let Some(cache) = roots.steam_cache.as_ref() else {
                eprintln!("Steam is not installed");
                std::process::exit(1);
            };
            for role in ArtRole::ALL {
                if let Some(found) = locate::steam(cache, id, role) {
                    let with_palette = matches!(role, ArtRole::Poster | ArtRole::Hero);
                    images.insert(
                        role.slug().into(),
                        image(&found.path, found.low_res, with_palette),
                    );
                }
            }
        } else if let Some(path) = arg.strip_prefix("file:") {
            images.insert(
                "icon".into(),
                image(std::path::Path::new(path), false, true),
            );
        } else {
            eprintln!("unknown argument «{arg}» (steam:<appid> or file:<path>)");
            std::process::exit(2);
        }
        out.push(json!({ "key": arg, "images": images }));
    }
    println!("{}", serde_json::to_string_pretty(&out).unwrap_or_default());
}
