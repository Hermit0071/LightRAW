fn main() {
    build_libraw_bridge();
    tauri_build::build()
}

fn build_libraw_bridge() {
    let target = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let include_paths = if target == "windows" {
        vcpkg::Config::new()
            .find_package("libraw")
            .expect("LibRaw must be installed through vcpkg on Windows")
            .include_paths
    } else {
        let library = pkg_config::Config::new()
            .cargo_metadata(false)
            .atleast_version("0.22")
            .probe("libraw_r")
            .expect("LibRaw 0.22 or newer is required");
        for path in &library.link_paths {
            println!("cargo:rustc-link-search=native={}", path.display());
        }
        println!("cargo:rustc-link-lib=dylib=raw_r");
        library.include_paths
    };

    let mut build = cc::Build::new();
    build.file("native/libraw_bridge.c");
    for path in include_paths {
        build.include(path);
    }
    build.compile("lightraw_libraw_bridge");
    println!("cargo:rerun-if-changed=native/libraw_bridge.c");
}
