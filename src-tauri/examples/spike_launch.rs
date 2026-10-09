//! Spike (e), step 6: what do the five launch types give back, and what happens with an
//! administrator program? Run: `cargo run -p hub --example spike_launch -- <command> [arg]`.
//!   exe <path> | lnk <path> | uri <uri> | uwp <aumid> | url <https://…>   plain launch
//!   admin-direct <path>     CreateProcess on an app that demands admin rights (expect 740)
//!   admin-runas <path>      ShellExecute «runas» (UAC prompt: accept or cancel it)
//!   front <pid> | close <pid>   bring to front / post WM_CLOSE from this (non-elevated) process
use std::time::Instant;

use hub_lib::launcher::request::LaunchRequest;
use hub_lib::launcher::system::SystemLauncher;
use hub_lib::launcher::Launcher;
use hub_lib::platform::{shell, window};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (cmd, arg) = (args.first().map(String::as_str), args.get(1).cloned());
    let arg = arg.unwrap_or_default();
    let started = Instant::now();
    let launch = |req: LaunchRequest| {
        let r = SystemLauncher.launch(&req);
        println!("{r:?} in {} ms", started.elapsed().as_millis());
    };
    match cmd {
        Some("exe") => launch(LaunchRequest::Exe {
            path: arg,
            args: vec![],
            cwd: None,
            elevated: false,
        }),
        Some("lnk" | "uri" | "url") => launch(LaunchRequest::Shell { target: arg }),
        Some("uwp") => launch(LaunchRequest::Uwp { aumid: arg }),
        Some("admin-direct") => launch(LaunchRequest::Exe {
            path: arg,
            args: vec![],
            cwd: None,
            elevated: false,
        }),
        Some("admin-runas") => launch(LaunchRequest::Exe {
            path: arg,
            args: vec![],
            cwd: None,
            elevated: true,
        }),
        Some("front") => {
            let pid: u32 = arg.parse().expect("pid");
            println!("bring_to_front -> {}", window::bring_to_front(&[pid]));
        }
        Some("close") => {
            let pid: u32 = arg.parse().expect("pid");
            println!("post_close -> {}", window::post_close(&[pid]));
        }
        _ => eprintln!("see the header of this file"),
    }
    let _ = shell::quote_arg("");
}
