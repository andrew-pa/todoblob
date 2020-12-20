use std::{borrow::Cow, path::{Path, PathBuf}, sync::{Arc, RwLock, atomic::{AtomicUsize, Ordering}}};
use rocket::request::State;
use rocket::response::{NamedFile, status::{NotFound, BadRequest}};
use rocket_contrib::json::{Json, JsonValue};

struct Data {
    last_version: AtomicUsize,
    last_data: Arc<RwLock<JsonValue>>,
    patches: Arc<RwLock<Vec<json_patch::Patch>>>
        // current version = last_version + patches.length()
}

#[rocket::get("/<file..>", rank = 0)]
async fn static_content(file: PathBuf) -> Result<NamedFile, NotFound<String>>{
    let path = Path::new("public/").join(file);
    NamedFile::open(&path).await.map_err(|e| NotFound(e.to_string()))
}

#[rocket::get("/api/user/<user_id>/data?<version>")]
fn get_data(user_id: Cow<str>, version: usize, state: State<Data>) -> JsonValue {
    /*let cur_ver = state.next_version.load(Ordering::Acquire).saturating_sub(1);
    serde_json::json!({
        "data": state.data.read().unwrap().clone(),
        "version": cur_ver
    }).into()*/
}

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

#[rocket::post("/api/user/<user_id>/data", data = "<patch>")]
fn accept_patches(user_id: Cow<str>, patch: Json<json_patch::Patch>, state: State<Data>)
    -> Result<JsonValue, BadRequest<String>>
{
    json_patch::patch(&mut state.data.write().unwrap(), &patch)
        .map_err(|e| BadRequest(Some(e.to_string())))?;
    let ver = state.next_version.fetch_add(1, Ordering::AcqRel);
    Ok(serde_json::json!({"version": ver}).into())
}

#[rocket::launch]
fn rocket() -> rocket::Rocket {
    rocket::ignite()
        .manage(Data {
            data: Arc::new(RwLock::new(
                          serde_json::json!({
                              "items": [
                                  { "text": "server item", "checked": false }
                              ]
                          }).into()
                  )),
            next_version: AtomicUsize::new(0)
        })
        .mount("/", rocket::routes![get_data, update_data, accept_patches])
}
