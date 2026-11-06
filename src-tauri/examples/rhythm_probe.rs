//! A dev tool (an example, so never shipped): the music mode's AI beat grid (media/rhythm.rs) on a
//! sound file, raw stereo f32 (little endian, interleaved), with the files of `resources/ai`.
//! Prints the beats and the downbeats (s), and how long it took.
//! `cargo run -q -p hub --example rhythm_probe -- <file.f32> <rate>`

use std::path::Path;
use std::time::Instant;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (path, rate) = (&args[1], args[2].parse::<u32>().expect("rate"));
    let bytes = std::fs::read(path).expect("file");
    let mono: Vec<f32> = bytes
        .as_chunks::<8>()
        .0
        .iter()
        .map(|c| {
            let l = f32::from_le_bytes([c[0], c[1], c[2], c[3]]);
            let r = f32::from_le_bytes([c[4], c[5], c[6], c[7]]);
            0.5 * (l + r)
        })
        .collect();
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/ai");
    let start = Instant::now();
    let (beats, downs) = hub_lib::media::rhythm::beats_of(&dir, &mono, rate).expect("rhythm");
    println!("ms {}", start.elapsed().as_millis());
    let show = |v: &[f32]| {
        v.iter()
            .map(|t| format!("{t:.2}"))
            .collect::<Vec<_>>()
            .join(" ")
    };
    println!("beats {}", show(&beats));
    println!("downbeats {}", show(&downs));
}
