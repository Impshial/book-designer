use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use tempfile::NamedTempFile;

pub const MAX_PACKAGE: u64 = 220_000_000;
pub fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    let mut s = path.as_os_str().to_owned();
    s.push(suffix);
    PathBuf::from(s)
}
pub fn validate(data: &str) -> Result<(String, u64), String> {
    if data.len() as u64 > MAX_PACKAGE {
        return Err("Project exceeds the 220 MB package limit.".into());
    }
    let value: serde_json::Value = serde_json::from_str(data).map_err(|e| e.to_string())?;
    if value["format"] != "book-designer" || value["version"] != 1 {
        return Err("Unsupported project format or version.".into());
    }
    let id = value["id"]
        .as_str()
        .ok_or("Project identity is missing.")?
        .to_owned();
    let rev = value["revision"]
        .as_u64()
        .ok_or("Project revision is missing.")?;
    Ok((id, rev))
}
pub fn atomic(path: &Path, bytes: &[u8], overwrite: bool) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid destination.")?;
    let mut temp = NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    if overwrite {
        temp.persist(path).map_err(|e| e.to_string())?;
    } else {
        temp.persist_noclobber(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn read(path: &Path) -> Result<String, String> {
    let size = fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > MAX_PACKAGE {
        return Err("Project exceeds the 220 MB package limit.".into());
    }
    let data = fs::read_to_string(path).map_err(|e| e.to_string())?;
    validate(&data)?;
    Ok(data)
}
pub fn save(path: &Path, data: &str, fail_after_recovery: bool) -> Result<(), String> {
    validate(data)?;
    // The new complete snapshot exists before any old state can be touched.
    atomic(&sidecar(path, ".recovery"), data.as_bytes(), true)?;
    if fail_after_recovery {
        return Err("Simulated interrupted save".into());
    }
    if path.exists() {
        let old = fs::read(path).map_err(|e| e.to_string())?;
        if std::str::from_utf8(&old)
            .ok()
            .and_then(|s| validate(s).ok())
            .is_some()
        {
            atomic(&sidecar(path, ".bak"), &old, true)?;
        }
    }
    atomic(path, data.as_bytes(), true)?;
    let _ = fs::remove_file(sidecar(path, ".recovery"));
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn data(rev: u64) -> String {
        format!(
            r#"{{"format":"book-designer","version":1,"id":"test","revision":{rev},"title":"Book"}}"#
        )
    }
    #[test]
    fn interrupted_save_preserves_last_good_and_recovery() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("book.bookdesigner");
        save(&path, &data(1), false).unwrap();
        assert!(save(&path, &data(2), true).is_err());
        assert_eq!(read(&path).unwrap(), data(1));
        assert_eq!(read(&sidecar(&path, ".recovery")).unwrap(), data(2));
        save(&path, &data(3), false).unwrap();
        assert_eq!(read(&path).unwrap(), data(3));
        assert_eq!(read(&sidecar(&path, ".bak")).unwrap(), data(1));
        assert!(!sidecar(&path, ".recovery").exists());
    }
    #[test]
    fn invalid_write_never_touches_original() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.bookdesigner");
        save(&path, &data(1), false).unwrap();
        assert!(save(&path, "{}", false).is_err());
        assert_eq!(read(&path).unwrap(), data(1));
    }
    #[test]
    fn create_never_clobbers() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.bookdesigner");
        atomic(&path, b"old", false).unwrap();
        assert!(atomic(&path, b"new", false).is_err());
        assert_eq!(fs::read(path).unwrap(), b"old");
    }
    #[test]
    fn portable_package_copy() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("one.bookdesigner");
        save(&path, &data(8), false).unwrap();
        let dest = dir.path().join("two.bookdesigner");
        fs::copy(&path, &dest).unwrap();
        assert_eq!(read(&path).unwrap(), read(&dest).unwrap());
    }
    #[test]
    fn recovering_corrupt_original_preserves_good_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.bookdesigner");
        save(&path, &data(1), false).unwrap();
        save(&path, &data(2), false).unwrap();
        fs::write(&path, b"broken").unwrap();
        save(&path, &data(3), false).unwrap();
        assert_eq!(read(&sidecar(&path, ".bak")).unwrap(), data(1));
        assert_eq!(read(&path).unwrap(), data(3));
    }
}
