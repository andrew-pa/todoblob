use std::{borrow::Cow, collections::HashMap, path::{Path, PathBuf}, sync::{Arc, RwLock, atomic::{AtomicUsize, Ordering}}};
use rocket::request::State;
use rocket::response::{NamedFile, status::{NotFound, BadRequest, Custom}};
use rocket::http::{Cookie, CookieJar, Status};
use rocket_contrib::json::{Json, JsonValue};
use serde_json::json;
use log::{log, info, debug, warn, error};
use redis::Commands;
use time::Duration;

type DbPool = r2d2::Pool<redis::Client>;

macro_rules! handle_err {
    ($e:expr) => {
        match $e {
            Ok(x) => x,
            Err(e) => {
                error!("error: {} on ln {} col {} in {}", e, std::line!(), std::column!(), std::file!());
                return Err(rocket::response::status::Custom(rocket::http::Status::InternalServerError, ()));
            }
        }
    };
}

#[rocket::get("/<file..>", rank = 0)]
async fn static_content(file: PathBuf) -> Result<NamedFile, Custom<()>>{
    let path = Path::new("../client/build/").join(file);
    match NamedFile::open(&path).await {
        Ok(f) => Ok(f),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(handle_err!(NamedFile::open("../client/build/index.html").await))
        },
        Err(e) => handle_err!(Err(e))
    }
}

#[rocket::get("/", rank = 0)]
async fn spa_root() -> Result<NamedFile, Custom<()>>{
    let path = Path::new("../client/build/index.html");
    Ok(handle_err!(NamedFile::open(&path).await))
}


#[rocket::post("/api/user/new?<id>&<pswd>")]
fn create_new_user(db_pool: State<DbPool>, id: String, pswd: String) -> Result<(), Custom<()>> {
    let mut db_conn = handle_err!(db_pool.get());
    if handle_err!(db_conn.exists(format!("user:{}", id))) {
        Err(Custom(rocket::http::Status::BadRequest,()))
    } else {
        let uk = format!("user:{}", id);
        handle_err!(db_conn.hset_multiple(&uk, &[
            ("current_version", 0),
            ("last_version",    0),
        ]));
        handle_err!(db_conn.hset(uk, "password",
                handle_err!(bcrypt::hash(pswd, bcrypt::DEFAULT_COST))));
        handle_err!(db_conn.set(format!("data:{}", id), r#"{"items": [], "tags": []}"#));
        Ok(())
    }
}

#[rocket::get("/api/user/login?<id>&<pswd>")]
fn authenticate_user(db_pool: State<DbPool>, cookies: &CookieJar<'_>, id: String, pswd: String) -> Result<(), Custom<()>> {
    let mut db_conn = handle_err!(db_pool.get());
    let correct_pswd_hash: Option<String> = handle_err!(db_conn.hget(format!("user:{}", id), "password"));
    if let Some(correct_pswd_hash) = correct_pswd_hash {
        if handle_err!(bcrypt::verify(pswd, &correct_pswd_hash)) {
            let session_id = uuid::Uuid::new_v4().to_string();
            handle_err!(db_conn.set_ex(format!("session:{}", session_id), &id, Duration::days(7).whole_seconds() as usize));
            cookies.add(Cookie::build("session", session_id).max_age(Duration::days(7)).finish());
            Ok(())
        } else {
            Err(Custom(rocket::http::Status::Forbidden, ()))
        }
    } else {
        Err(Custom(rocket::http::Status::Forbidden, ()))
    }
}

fn user_id_for_session(db_conn: &mut impl Commands, cookies: &CookieJar<'_>) -> Result<String, Custom<()>> {
    cookies.get("session")
        .ok_or(Custom(Status::Unauthorized, ()))
        .and_then(|sid| {
            debug!("checking session:{}", sid.value());
            let usr: Option<String> = handle_err!(db_conn.get(format!("session:{}", sid.value())));
            debug!("got user id: {:?}", usr);
            usr.ok_or(Custom(Status::NotFound, ()))
        })
}

#[rocket::get("/api/user/check_cookie")]
fn check_user_cookie(db_pool: State<DbPool>, cookies: &CookieJar<'_>) -> Result<String, Custom<()>> {
    let mut db_conn = handle_err!(db_pool.get());
    user_id_for_session(&mut *db_conn, cookies)
}

#[rocket::get("/api/data?<client_version>")]
fn get_data(db_pool: State<DbPool>, cookies: &CookieJar<'_>, client_version: isize) -> Result<JsonValue, Custom<()>> {
    let mut db_conn = handle_err!(db_pool.get());
    let user_id = user_id_for_session(&mut *db_conn, cookies)?;

    let info: HashMap<String, String> = handle_err!(db_conn.hgetall(format!("user:{}", user_id)));
    let current_version: isize = handle_err!(info["current_version"].parse());
    let last_version: isize = handle_err!(info["last_version"].parse());

    if client_version < last_version || client_version > current_version { // really old data
        let data_str: String = handle_err!(db_conn.get(format!("data:{}", user_id)));
        debug!("got data_str = {}", data_str);
        let current_data: serde_json::Value = handle_err!(serde_json::from_str(&data_str));
        Ok(json!({
            "data": current_data,
            "version": current_version
        }).into())
    } else {
        if client_version < current_version {
            let patch_strs: Vec<String> =  handle_err!(db_conn.lrange(format!("patches:{}", user_id), client_version - last_version, -1));
            debug!("got patch strs {}: {:?}", client_version - last_version, patch_strs);
            let patch = patch_strs.iter().map(|s| serde_json::from_str(&s).unwrap()).flat_map(|p: json_patch::Patch| p.0.into_iter()).collect::<Vec<_>>();
            Ok(json!({
                "patch": patch,
                "version": current_version
            }).into())
        } else {
            // client data is up to date
            Ok(JsonValue::default())
        }
    }
}

#[rocket::post("/api/data", data = "<patch>")]
fn accept_patches(db_pool: State<DbPool>, cookies: &CookieJar<'_>, patch: Json<json_patch::Patch>)
    -> Result<JsonValue, Custom<()>>
{
    let mut db_conn = handle_err!(db_pool.get());
    let user_id = user_id_for_session(&mut *db_conn, cookies)?;

    let uk = format!("user:{}", user_id);
    let info: HashMap<String, String> = handle_err!(db_conn.hgetall(&uk));
    let mut current_version: isize = handle_err!(info["current_version"].parse());
    let last_version: isize = handle_err!(info["last_version"].parse());

    let data_str: String = handle_err!(db_conn.get(format!("data:{}", user_id)));
    let mut current_data = handle_err!(serde_json::from_str(&data_str));

    handle_err!(json_patch::patch(&mut current_data, &patch));
    current_version += 1;
    handle_err!(db_conn.hset(&uk, "current_version", current_version));
    handle_err!(db_conn.set(format!("data:{}", user_id), serde_json::to_string(&current_data).unwrap()));
    let pk = format!("patches:{}", user_id);
    let num_patches: usize = handle_err!(db_conn.llen(&pk));

    // this should be atomic
    if num_patches > 20 {
        info!("clearing patch cache for {}", user_id);
        handle_err!(db_conn.hset(&uk, "last_version", current_version));
        handle_err!(db_conn.del(&pk));
    } else {
        handle_err!(db_conn.rpush(&pk, handle_err!(serde_json::to_string(&*patch))));
    }
    Ok(json!({ "version": current_version }).into())
}

#[rocket::launch]
fn rocket() -> rocket::Rocket {
    env_logger::init();
    info!("starting up!");
    let redis_url = std::env::var("REDIS_URL").unwrap_or("redis://127.0.0.1".into());
    info!("redis @ {}", redis_url);
    let redis_client = redis::Client::open(redis_url).unwrap();
    let db_pool = r2d2::Pool::builder().max_size(32).build(redis_client).unwrap();
    rocket::ignite()
        .manage(db_pool)
        .mount("/", rocket::routes![
            static_content, spa_root,
            get_data, accept_patches,
            create_new_user, authenticate_user, check_user_cookie
        ])
}
