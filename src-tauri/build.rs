fn main() {
    if let Err(error) = tauri_build::try_build(tauri_build::Attributes::new()) {
        eprintln!("Error in tauri_build: {error:#}");
        std::process::exit(1);
    }
}
