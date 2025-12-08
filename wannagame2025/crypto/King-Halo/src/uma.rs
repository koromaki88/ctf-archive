use crate::racing::Strategy;
use std::collections::HashMap;
use std::fs;
use std::io;

#[derive(Clone, Debug)]
pub struct Uma {
    pub name: String,
    pub style: Strategy,
}

pub fn load_umas(path: &str) -> io::Result<Vec<Uma>> {
    let file = fs::read_to_string(path)?;
    let raw: HashMap<String, u8> =
        serde_json::from_str(&file).map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err))?;

    let mut umas = Vec::new();
    for (name, style_id) in raw {
        if let Some(style) = strategy_from_id(style_id) {
            umas.push(Uma { name, style });
        }
    }

    Ok(umas)
}

fn strategy_from_id(id: u8) -> Option<Strategy> {
    match id {
        0 => Some(Strategy::Front),
        1 => Some(Strategy::Pace),
        2 => Some(Strategy::Late),
        3 => Some(Strategy::End),
        _ => None,
    }
}
