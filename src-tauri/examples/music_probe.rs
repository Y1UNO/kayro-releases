//! A dev tool (an example, so never shipped): the music mode's analysis of a sound file, for
//! tuning and measuring it (docs/MODE-MUSIQUE.md). The file is raw stereo f32 (little endian,
//! interleaved left, right); prints one CSV line per 10 ms: time (s), sub, melody, voice, pitch,
//! and the hits of those 10 ms (`kick:0.82` …).
//! `cargo run -q -p hub --example music_probe -- <file.f32> <rate>`

use hub_lib::media::music::Analyzer;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (path, rate) = (&args[1], args[2].parse::<u32>().expect("rate"));
    let bytes = std::fs::read(path).expect("file");
    let frames: Vec<(f32, f32)> = bytes
        .as_chunks::<8>()
        .0
        .iter()
        .map(|c| {
            let l = f32::from_le_bytes([c[0], c[1], c[2], c[3]]);
            let r = f32::from_le_bytes([c[4], c[5], c[6], c[7]]);
            (l, r)
        })
        .collect();
    let mut a = Analyzer::new(rate);
    let step = (rate / 100) as usize;
    println!("t,sub,melody,voice,pitch,hits");
    let mut hits = Vec::new();
    for chunk in frames.chunks(step) {
        let mid: Vec<f32> = chunk.iter().map(|(l, r)| 0.5 * (l + r)).collect();
        let side: Vec<f32> = chunk.iter().map(|(l, r)| 0.5 * (l - r)).collect();
        a.push_stereo(&mid, &side, &mut hits);
        let l = a.levels();
        let h: Vec<String> = hits
            .drain(..)
            .map(|h| format!("{:?}:{:.2}", h.kind, h.velocity))
            .collect();
        println!(
            "{:.3},{:.3},{:.3},{:.3},{:.3},{}",
            a.time(),
            l.sub,
            l.melody,
            l.voice,
            l.pitch,
            h.join(" ")
        );
    }
}
