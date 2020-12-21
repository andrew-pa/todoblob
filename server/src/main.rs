use std::{borrow::Cow, path::{Path, PathBuf}, sync::{Arc, RwLock, atomic::{AtomicUsize, Ordering}}};
use rocket::request::State;
use rocket::response::{NamedFile, status::{NotFound, BadRequest}};
use rocket_contrib::json::{Json, JsonValue};
use serde_json::json;

struct DataInner {
    current_version: usize,
    current_data: JsonValue,
    last_version: usize,
    patches: Vec<json_patch::Patch>
}

type Data = Arc<RwLock<DataInner>>;

#[rocket::get("/<file..>", rank = 0)]
async fn static_content(file: PathBuf) -> Result<NamedFile, NotFound<String>>{
    let path = Path::new("public/").join(file);
    NamedFile::open(&path).await.map_err(|e| NotFound(e.to_string()))
}

#[rocket::get("/api/user/<user_id>/data?<client_version>")]
fn get_data(user_id: Cow<str>, client_version: isize, state: State<Data>) -> JsonValue {
    let data = state.read().unwrap();
    if client_version < data.last_version as isize || client_version > data.current_version as isize { // really old data
        json!({
            "data": data.current_data,
            "version": data.current_version
        }).into()
    } else {
        if client_version < data.current_version as isize {
            json!({
                "patch": data.patches[client_version as usize-data.last_version..].iter().flat_map(|p| p.0.iter()).collect::<Vec<_>>(),
                "version": data.current_version
            }).into()
        } else {
            // client data is up to date
            JsonValue::default()
        }
    }
    /*let cur_ver = state.next_version.load(Ordering::Acquire).saturating_sub(1);
    serde_json::json!({
        "data": state.data.read().unwrap().clone(),
        "version": cur_ver
    }).into()*/
}

/*
#[rocket::get("/api/user/<user_id>/update_data?<version>")]
fn update_data(user_id: Cow<str>, version: usize, state: State<Data>) -> JsonValue {
    let cur_ver = state.next_version.load(Ordering::Acquire).saturating_sub(1);
    if cur_ver > version {
        serde_json::json!({
            "data": state.data.read().unwrap().clone(),
            "version": cur_ver
        }).into()
    } else {
        JsonValue::default()
    }
}
*/

#[rocket::post("/api/user/<user_id>/data", data = "<patch>")]
fn accept_patches(user_id: Cow<str>, patch: Json<json_patch::Patch>, state: State<Data>)
    -> Result<JsonValue, BadRequest<JsonValue>>
{
    let mut data = state.write().unwrap();
    json_patch::patch(&mut data.current_data, &patch)
        .map_err(|e| BadRequest(Some(json!({"error": e.to_string()}).into())))?;
    data.current_version += 1;
    if data.patches.len() > 20 {
        println!("clearing patch cache");
        data.last_version = data.current_version;
        data.patches.clear();
    } else {
        data.patches.push(patch.clone());
    }
    Ok(json!({ "version": data.current_version }).into())
}

#[rocket::launch]
fn rocket() -> rocket::Rocket {
    rocket::ignite()
        .manage(Arc::new(RwLock::new(DataInner {
            current_version: 0,
            last_version: 0,
            current_data: serde_json::json!({
                              "items": [
                                  { "text": "server item", "checked": false }
                              ]
                          }).into(),
            patches: Vec::new()
        })))
        .mount("/", rocket::routes![get_data, accept_patches])
}
