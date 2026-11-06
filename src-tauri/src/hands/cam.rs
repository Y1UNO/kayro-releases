//! The webcam through Media Foundation's source reader: the first video device, a small native
//! format (about 640 wide, 30 frames a second or more, uncompressed if it can), converted to
//! BGRA by Media Foundation. Frames are read synchronously and copied top-down. Dropping it
//! shuts the source down (the webcam's light goes off).
//! Measured on 2026-11-05 (FHD Camera, spikes/07-mains): opened in 90–150 ms; 24–25 frames a
//! second with the light on, 15 in a dark room (the camera's own clock), 0.2 % of the machine.

use windows::core::{Interface, PWSTR};
use windows::Win32::Media::MediaFoundation::*;
use windows::Win32::System::Com::{CoInitializeEx, CoTaskMemFree, COINIT_MULTITHREADED};

pub struct Format {
    pub index: u32,
    pub sub: String,
    pub w: u32,
    pub h: u32,
    pub fps: f32,
}

pub struct Cam {
    reader: IMFSourceReader,
    source: IMFMediaSource,
    pub name: String,
    pub w: u32,
    pub h: u32,
    pub fps: f32,
    pub sub: String,
}

const STREAM: u32 = MF_SOURCE_READER_FIRST_VIDEO_STREAM.0 as u32;

fn fourcc(g: &windows::core::GUID) -> String {
    let b = g.data1.to_le_bytes();
    if b.iter().all(|c| c.is_ascii_graphic()) {
        String::from_utf8_lossy(&b).into_owned()
    } else if *g == MFVideoFormat_RGB32 {
        "RGB32".into()
    } else {
        format!("{:?}", g)
    }
}

fn split(v: u64) -> (u32, u32) {
    ((v >> 32) as u32, v as u32)
}

fn describe(t: &IMFMediaType, index: u32) -> windows::core::Result<Format> {
    // SAFETY: plain attribute reads on a media type the reader gave us.
    unsafe {
        let sub = t.GetGUID(&MF_MT_SUBTYPE)?;
        let (w, h) = split(t.GetUINT64(&MF_MT_FRAME_SIZE)?);
        let (n, d) = split(t.GetUINT64(&MF_MT_FRAME_RATE)?);
        Ok(Format {
            index,
            sub: fourcc(&sub),
            w,
            h,
            fps: n as f32 / d.max(1) as f32,
        })
    }
}

impl Cam {
    /// Opens the first webcam; `want_w` is the width looked for (the closest is taken).
    pub fn open(want_w: u32) -> windows::core::Result<Self> {
        // SAFETY: COM and Media Foundation calls in their documented order; the activation
        // array is freed with CoTaskMemFree after its objects are taken out.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            MFStartup(MF_VERSION, MFSTARTUP_FULL)?;
            let mut attr: Option<IMFAttributes> = None;
            MFCreateAttributes(&mut attr, 1)?;
            let attr = attr.expect("attributes");
            attr.SetGUID(
                &MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE,
                &MF_DEVSOURCE_ATTRIBUTE_SOURCE_TYPE_VIDCAP_GUID,
            )?;
            let mut arr: *mut Option<IMFActivate> = std::ptr::null_mut();
            let mut count = 0u32;
            MFEnumDeviceSources(&attr, &mut arr, &mut count)?;
            if count == 0 {
                return Err(windows::core::Error::new(
                    windows::Win32::Foundation::E_FAIL,
                    "aucune webcam",
                ));
            }
            let devices = std::slice::from_raw_parts_mut(arr, count as usize);
            let first = devices[0].take().expect("device");
            for d in devices.iter_mut() {
                d.take();
            }
            CoTaskMemFree(Some(arr as *const _));
            let mut name = PWSTR::null();
            let mut len = 0u32;
            first.GetAllocatedString(&MF_DEVSOURCE_ATTRIBUTE_FRIENDLY_NAME, &mut name, &mut len)?;
            let name_s = name.to_string().unwrap_or_default();
            CoTaskMemFree(Some(name.0 as *const _));
            let source: IMFMediaSource = first.ActivateObject()?;

            let mut rattr: Option<IMFAttributes> = None;
            MFCreateAttributes(&mut rattr, 1)?;
            let rattr = rattr.expect("attributes");
            rattr.SetUINT32(&MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, 1)?;
            let reader = MFCreateSourceReaderFromMediaSource(&source, &rattr)?;

            let mut formats = Vec::new();
            let mut i = 0;
            while let Ok(t) = reader.GetNativeMediaType(STREAM, i) {
                if let Ok(f) = describe(&t, i) {
                    formats.push(f);
                }
                i += 1;
            }
            // The closest width, then 30 frames a second or more, then uncompressed, then faster.
            let best = formats
                .iter()
                .min_by_key(|f| {
                    let slow = (f.fps < 29.0) as u32;
                    let mjpg = (f.sub == "MJPG") as u32;
                    (f.w.abs_diff(want_w), slow, mjpg, (1000.0 - f.fps) as u32)
                })
                .expect("a format");
            let native = reader.GetNativeMediaType(STREAM, best.index)?;
            reader.SetCurrentMediaType(STREAM, None, &native)?;
            let out = MFCreateMediaType()?;
            out.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
            out.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)?;
            reader.SetCurrentMediaType(STREAM, None, &out)?;
            let cur = reader.GetCurrentMediaType(STREAM)?;
            let f = describe(&cur, 0)?;
            Ok(Self {
                reader,
                source,
                name: name_s,
                w: f.w,
                h: f.h,
                fps: best.fps,
                sub: best.sub.clone(),
            })
        }
    }

    /// The next frame as top-down BGRA in `out`; false on a stream tick (no frame).
    pub fn read(&self, out: &mut Vec<u8>) -> windows::core::Result<bool> {
        let (w, h) = (self.w as usize, self.h as usize);
        out.resize(w * h * 4, 0);
        // SAFETY: the buffer stays locked while its rows are copied, inside its own pitch.
        unsafe {
            let mut flags = 0u32;
            let mut sample: Option<IMFSample> = None;
            self.reader
                .ReadSample(STREAM, 0, None, Some(&mut flags), None, Some(&mut sample))?;
            let Some(sample) = sample else {
                return Ok(false);
            };
            let buf = sample.ConvertToContiguousBuffer()?;
            if let Ok(b2) = buf.cast::<IMF2DBuffer>() {
                let mut line0: *mut u8 = std::ptr::null_mut();
                let mut pitch = 0i32;
                b2.Lock2D(&mut line0, &mut pitch)?;
                let row = (w * 4).min(pitch.unsigned_abs() as usize);
                for y in 0..h {
                    let src = line0.offset(y as isize * pitch as isize);
                    std::ptr::copy_nonoverlapping(src, out[y * w * 4..].as_mut_ptr(), row);
                }
                b2.Unlock2D()?;
            } else {
                let mut p: *mut u8 = std::ptr::null_mut();
                let mut len = 0u32;
                buf.Lock(&mut p, None, Some(&mut len))?;
                let n = (len as usize).min(out.len());
                std::ptr::copy_nonoverlapping(p, out.as_mut_ptr(), n);
                buf.Unlock()?;
            }
            Ok(true)
        }
    }
}

impl Drop for Cam {
    fn drop(&mut self) {
        // SAFETY: the source this reader owns; matches MFStartup in open.
        unsafe {
            let _ = self.source.Shutdown();
            let _ = MFShutdown();
        }
    }
}
