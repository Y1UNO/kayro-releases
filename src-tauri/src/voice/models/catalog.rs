//! The voice's models: where each file comes from, its SHA-256 fingerprint (pinned on
//! 2026-11-04) and its size.

use crate::voice::brain::{DIR as BRAIN_DIR, MMPROJ, MODEL, RUNTIME_ZIP};
use crate::voice::engine::{CANARY_DIR, PARAKEET_DIR, SPEAKER_FILE, WAKE_DIR};

pub struct File {
    pub name: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub size: u64,
}

pub struct Model {
    pub id: &'static str,
    /// Its folder in the voice folder (empty: the file sits at its root).
    pub dir: &'static str,
    pub files: &'static [File],
}

pub const HF: &str = "https://huggingface.co";

macro_rules! hf {
    ($repo:literal, $file:literal) => {
        concat!("https://huggingface.co/", $repo, "/resolve/main/", $file)
    };
}

pub const MODELS: &[Model] = &[
    Model {
        id: "silero",
        dir: "",
        files: &[File {
            name: "silero_vad.onnx",
            url:
                "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx",
            sha256: "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6",
            size: 643_854,
        }],
    },
    Model {
        id: "speaker",
        dir: "",
        files: &[File {
            name: SPEAKER_FILE,
            url: concat!(
                "https://github.com/k2-fsa/sherpa-onnx/releases/download/",
                "speaker-recongition-models/",
                "3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx"
            ),
            sha256: "aa3cfc16963a10586a9393f5035d6d6b57e98d358b347f80c2a30bf4f00ceba2",
            size: 28_281_164,
        }],
    },
    Model {
        id: "wake",
        dir: WAKE_DIR,
        files: &[
            File {
                name: "encoder-epoch-29-avg-9-with-averaged-model.int8.onnx",
                url: hf!(
                    "shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14",
                    "encoder-epoch-29-avg-9-with-averaged-model.int8.onnx"
                ),
                sha256: "47a94a7fdc8dff63d708be4ea0535747640224467f91e238311f1ddbdd09327e",
                size: 126_655_903,
            },
            File {
                name: "decoder-epoch-29-avg-9-with-averaged-model.int8.onnx",
                url: hf!(
                    "shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14",
                    "decoder-epoch-29-avg-9-with-averaged-model.int8.onnx"
                ),
                sha256: "e72b2b9ed36355bd0dd43433f7dd258e7226ab54c9ef42b28c73ebb785805623",
                size: 1_307_157,
            },
            File {
                name: "joiner-epoch-29-avg-9-with-averaged-model.int8.onnx",
                url: hf!(
                    "shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14",
                    "joiner-epoch-29-avg-9-with-averaged-model.int8.onnx"
                ),
                sha256: "fc2f3bb851a15a532c6f2422d53eecd1ca949f12b0897e07a852021c30481711",
                size: 259_572,
            },
            File {
                name: "tokens.txt",
                url: hf!(
                    "shaojieli/sherpa-onnx-streaming-zipformer-fr-2023-04-14",
                    "tokens.txt"
                ),
                sha256: "37fb3f2a7bcb85e5fff3f1f66be04e6fbb05077a22f56d177fe85704e945fb31",
                size: 4_819,
            },
        ],
    },
    Model {
        id: "parakeet",
        dir: PARAKEET_DIR,
        files: &[
            File {
                name: "encoder.int8.onnx",
                url: hf!(
                    "csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
                    "encoder.int8.onnx"
                ),
                sha256: "acfc2b4456377e15d04f0243af540b7fe7c992f8d898d751cf134c3a55fd2247",
                size: 652_184_281,
            },
            File {
                name: "decoder.int8.onnx",
                url: hf!(
                    "csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
                    "decoder.int8.onnx"
                ),
                sha256: "179e50c43d1a9de79c8a24149a2f9bac6eb5981823f2a2ed88d655b24248db4e",
                size: 11_845_275,
            },
            File {
                name: "joiner.int8.onnx",
                url: hf!(
                    "csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
                    "joiner.int8.onnx"
                ),
                sha256: "3164c13fc2821009440d20fcb5fdc78bff28b4db2f8d0f0b329101719c0948b3",
                size: 6_355_277,
            },
            File {
                name: "tokens.txt",
                url: hf!(
                    "csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
                    "tokens.txt"
                ),
                sha256: "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d",
                size: 93_939,
            },
        ],
    },
    Model {
        id: "canary",
        dir: CANARY_DIR,
        files: &[
            File {
                name: "encoder.int8.onnx",
                url: hf!(
                    "csukuangfj/sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr-int8",
                    "encoder.int8.onnx"
                ),
                sha256: "7a75b4e2a5857a6dcc0819503bbe3fad66943db4a3ccf21d3f27c633667d303f",
                size: 132_678_643,
            },
            File {
                name: "decoder.int8.onnx",
                url: hf!(
                    "csukuangfj/sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr-int8",
                    "decoder.int8.onnx"
                ),
                sha256: "e41a2ab9c0c2fe81a1e8ade5a45fb02a74bc4db7d1f91b89a54a25e2cf79cba2",
                size: 74_437_848,
            },
            File {
                name: "tokens.txt",
                url: hf!(
                    "csukuangfj/sherpa-onnx-nemo-canary-180m-flash-en-es-de-fr-int8",
                    "tokens.txt"
                ),
                sha256: "2dae6fc7815f9640645e0c765522b278ee0cef49b482d91f6913e334628d3e77",
                size: 53_555,
            },
        ],
    },
    // The brain (brain/mod.rs): llama.cpp's Vulkan build (unpacked once downloaded), Gemma 4 E4B
    // and its listening part. Pinned on 2026-11-04 (llama.cpp b12110, the model at its revision).
    Model {
        id: "brain",
        dir: BRAIN_DIR,
        files: &[
            File {
                name: RUNTIME_ZIP,
                url: concat!(
                    "https://github.com/ggml-org/llama.cpp/releases/download/b12110/",
                    "llama-b12110-bin-win-vulkan-x64.zip"
                ),
                sha256: "9732a5e48887ca54d0bfe4af4324dc85fd56cd8cda19b52df3542fa6ebe6874f",
                size: 37_661_146,
            },
            File {
                name: MODEL,
                url: concat!(
                    "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/",
                    "a69f018d7678a2b9f5e705f8903d6fb29b9b25dc/gemma-4-E4B-it-Q4_0.gguf"
                ),
                sha256: "a555b900214b477d8880e7832e0b8925e139b0159640036b09fe472b6f2097f2",
                size: 4_590_807_392,
            },
            File {
                name: MMPROJ,
                url: concat!(
                    "https://huggingface.co/ggml-org/gemma-4-E4B-it-GGUF/resolve/",
                    "a69f018d7678a2b9f5e705f8903d6fb29b9b25dc/mmproj-gemma-4-E4B-it-Q8_0.gguf"
                ),
                sha256: "197f49a93027f9843772bd24a6a9e0be2a32a788de5a3def330e9c585d86edd1",
                size: 559_874_816,
            },
        ],
    },
];
