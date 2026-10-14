mod storage;
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::Mutex,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
struct Access {
    files: HashMap<PathBuf, u64>,
    folders: HashSet<PathBuf>,
}
type State<'a> = tauri::State<'a, Mutex<Access>>;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Opened {
    path: String,
    data: String,
    recovery: Option<String>,
    backup: Option<String>,
}
fn filename(title: &str) -> String {
    let name: String = title
        .chars()
        .map(|c| {
            if c.is_control() || "<>:\"/\\|?*".contains(c) {
                '_'
            } else {
                c
            }
        })
        .take(100)
        .collect();
    format!("{}{}.bookdesigner", "Book-", name.trim_matches([' ', '.']))
}
#[tauri::command]
async fn choose_folder(app: tauri::AppHandle, state: State<'_>) -> Result<Option<String>, String> {
    let Some(folder) = app
        .dialog()
        .file()
        .set_title("Choose a folder for your book")
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let path = folder
        .into_path()
        .map_err(|e| e.to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    state
        .lock()
        .map_err(|e| e.to_string())?
        .folders
        .insert(path.clone());
    Ok(Some(path.to_string_lossy().into()))
}
#[tauri::command]
async fn create_book(
    folder: String,
    title: String,
    data: String,
    state: State<'_>,
) -> Result<String, String> {
    let (_, rev) = storage::validate(&data)?;
    let dir = PathBuf::from(folder)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let mut access = state.lock().map_err(|e| e.to_string())?;
    if !access.folders.contains(&dir) {
        return Err("Select the save folder using Browse first.".into());
    }
    let path = dir.join(filename(&title));
    storage::atomic(&path, data.as_bytes(), false)
        .map_err(|e| format!("Could not create project; choose another title or folder. {e}"))?;
    access.files.insert(path.clone(), rev);
    Ok(path.to_string_lossy().into())
}
#[tauri::command]
async fn open_book(app: tauri::AppHandle, state: State<'_>) -> Result<Option<Opened>, String> {
    let Some(file) = app
        .dialog()
        .file()
        .add_filter("Book Designer", &["bookdesigner"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };
    let path = file
        .into_path()
        .map_err(|e| e.to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let data = match storage::read(&path) {
        Ok(d) => d,
        Err(original) => {
            if storage::read(&storage::sidecar(&path, ".recovery")).is_ok()
                || storage::read(&storage::sidecar(&path, ".bak")).is_ok()
            {
                String::new()
            } else {
                return Err(original);
            }
        }
    };
    let rev = storage::validate(&data).map(|x| x.1).unwrap_or(0);
    state
        .lock()
        .map_err(|e| e.to_string())?
        .files
        .insert(path.clone(), rev);
    let recovery = storage::read(&storage::sidecar(&path, ".recovery")).ok();
    let backup = storage::read(&storage::sidecar(&path, ".bak")).ok();
    Ok(Some(Opened {
        path: path.to_string_lossy().into(),
        data,
        recovery,
        backup,
    }))
}
#[tauri::command]
async fn save_book(path: String, data: String, state: State<'_>) -> Result<(), String> {
    let (_, rev) = storage::validate(&data)?;
    let path = PathBuf::from(path);
    let mut access = state.lock().map_err(|e| e.to_string())?;
    let last = access
        .files
        .get(&path)
        .ok_or("Choose this file with Open or Save As before saving.")?;
    if rev < *last {
        return Err("A stale save was rejected. Your newer project is safe.".into());
    }
    storage::save(&path, &data, false)?;
    access.files.insert(path, rev);
    Ok(())
}
#[tauri::command]
async fn write_recovery(path: String, data: String, state: State<'_>) -> Result<(), String> {
    let (_, rev) = storage::validate(&data)?;
    let path = PathBuf::from(path);
    let access = state.lock().map_err(|e| e.to_string())?;
    let last = access
        .files
        .get(&path)
        .ok_or("Open or save this book first.")?;
    if rev < *last {
        return Ok(());
    }
    storage::atomic(&storage::sidecar(&path, ".recovery"), data.as_bytes(), true)
}
#[tauri::command]
async fn discard_recovery(path: String, state: State<'_>) -> Result<(), String> {
    let path = PathBuf::from(path);
    let access = state.lock().map_err(|e| e.to_string())?;
    if !access.files.contains_key(&path) {
        return Err("Open or save this book first.".into());
    }
    match std::fs::remove_file(storage::sidecar(&path, ".recovery")) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
#[tauri::command]
async fn save_as_book(
    app: tauri::AppHandle,
    title: String,
    data: String,
    state: State<'_>,
) -> Result<Option<String>, String> {
    let (_, rev) = storage::validate(&data)?;
    let Some(file) = app
        .dialog()
        .file()
        .set_file_name(filename(&title))
        .add_filter("Book Designer", &["bookdesigner"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = file.into_path().map_err(|e| e.to_string())?;
    storage::save(&path, &data, false)?;
    state
        .lock()
        .map_err(|e| e.to_string())?
        .files
        .insert(path.clone(), rev);
    Ok(Some(path.to_string_lossy().into()))
}
#[tauri::command]
async fn export_pdf(
    app: tauri::AppHandle,
    title: String,
    bytes: Vec<u8>,
    report: String,
) -> Result<Option<String>, String> {
    if bytes.len() > 220_000_000 || !bytes.starts_with(b"%PDF-") {
        return Err("Invalid PDF output.".into());
    }
    let _: serde_json::Value = serde_json::from_str(&report).map_err(|e| e.to_string())?;
    let Some(file) = app
        .dialog()
        .file()
        .set_file_name(format!(
            "{}-proof.pdf",
            filename(&title).trim_end_matches(".bookdesigner")
        ))
        .add_filter("Reading proof PDF", &["pdf"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = file.into_path().map_err(|e| e.to_string())?;
    storage::atomic(&path, &bytes, true)?;
    storage::atomic(
        &storage::sidecar(&path, ".report.json"),
        report.as_bytes(),
        true,
    )
    .map_err(|e| format!("PDF saved, but its validation report could not be written: {e}"))?;
    Ok(Some(path.to_string_lossy().into()))
}
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(Access::default()))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            choose_folder,
            create_book,
            open_book,
            save_book,
            save_as_book,
            write_recovery,
            discard_recovery,
            export_pdf
        ])
        .setup(|app| {
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Book Designer could not start");
}
