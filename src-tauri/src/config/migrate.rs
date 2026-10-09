use serde_json::Value;

/// One step `vN → vN+1` over the raw JSON (steps never see typed structs, so old shapes
/// can be read long after the Rust types have moved on).
pub type Migration = fn(Value) -> Result<Value, String>;

/// Version the program writes for a file whose chain has `steps` migrations.
pub fn current_version(steps: &[Migration]) -> u32 {
    steps.len() as u32 + 1
}

/// Runs the chain from `from` up to the current version and stamps `schemaVersion`.
/// `Err` for versions the program cannot read (0, or newer than itself) or a failing step.
pub fn migrate(mut value: Value, from: u32, steps: &[Migration]) -> Result<Value, String> {
    let current = current_version(steps);
    if from == 0 || from > current {
        return Err(format!(
            "unsupported schemaVersion {from} (this build writes {current})"
        ));
    }
    for version in from..current {
        value = steps[(version - 1) as usize](value)
            .map_err(|e| format!("migration v{version} → v{} failed: {e}", version + 1))?;
        match value.as_object_mut() {
            Some(o) => o.insert("schemaVersion".into(), (version + 1).into()),
            None => return Err("migration did not return an object".into()),
        };
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn v1_to_v2(mut v: Value) -> Result<Value, String> {
        let o = v.as_object_mut().ok_or("not an object")?;
        let old = o.remove("title").unwrap_or(Value::Null);
        o.insert("name".into(), old);
        Ok(v)
    }
    fn v2_to_v3(mut v: Value) -> Result<Value, String> {
        v.as_object_mut()
            .ok_or("not an object")?
            .insert("extra".into(), json!(true));
        Ok(v)
    }
    fn failing(_: Value) -> Result<Value, String> {
        Err("boom".into())
    }

    #[test]
    fn chains_steps_and_stamps_version() {
        let out = migrate(
            json!({"schemaVersion":1,"title":"x"}),
            1,
            &[v1_to_v2, v2_to_v3],
        )
        .unwrap();
        assert_eq!(out, json!({"schemaVersion":3,"name":"x","extra":true}));
    }

    #[test]
    fn starts_from_the_files_version() {
        let out = migrate(
            json!({"schemaVersion":2,"name":"x"}),
            2,
            &[v1_to_v2, v2_to_v3],
        )
        .unwrap();
        assert_eq!(out["schemaVersion"], 3);
        assert!(out.get("title").is_none());
    }

    #[test]
    fn current_version_needs_no_step() {
        let v = json!({"schemaVersion":1});
        assert_eq!(migrate(v.clone(), 1, &[]).unwrap(), v);
    }

    #[test]
    fn rejects_zero_and_future_versions() {
        assert!(migrate(json!({}), 0, &[]).is_err());
        assert!(migrate(json!({}), 2, &[]).is_err());
    }

    #[test]
    fn failing_step_is_reported() {
        let err = migrate(json!({"schemaVersion":1}), 1, &[failing]).unwrap_err();
        assert!(err.contains("v1 → v2"));
    }
}
