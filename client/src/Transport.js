import React from 'react';
import jsonPatch from 'json8-patch';
import oo from 'json8';
import cookies from 'browser-cookies';

function smartPatchMerge(src_a, src_b) {
    // you could probably skip add/remove pairs that canceled out, but that would be tricky for questionable benefit
    let main = oo.clone(src_a);
    src_b.forEach((patch) => {
        if(patch.op === 'replace') {
            let existing = main.find(p => p.op === 'replace' && p.path === patch.path);
            if(existing) existing.value = patch.value;
            else main.push(patch);
        } else {
            main.push(patch);
        }
    });
    return main;
}

export function usePatchableState(initial) {
    const [state, setState] = React.useState(initial);

    return [ state, patch => setState(prev_state => jsonPatch.apply(oo.clone(prev_state), patch).doc) ];
}

export function useAccount(onLoginSuccess, onLoginFailure, onLogout) {
    const [userId, setUserId] = React.useState(null);

    const login = React.useCallback((suser_id, spassword) => {
        fetch(`/api/user/login?id=${suser_id}&pswd=${spassword}`)
            .then(res => {
                if(res.status === 200) {
                    setUserId(suser_id);
                    onLoginSuccess();
                } else if(res.status === 403) {
                    onLoginFailure(true);
                } else {
                    onLoginFailure(false);
                }
            });
    }, [onLoginSuccess, onLoginFailure]);

    const logout = React.useCallback(() => {
        if(userId !== null) {
            cookies.erase('session');
        }
        setUserId(null);
        onLogout();
    }, [userId, onLogout]);

    React.useLayoutEffect(() => {
        if(!cookies.get('session')) return;
        fetch('/api/user/check_cookie')
            .then(res => {
                if(res.status === 200) {
                    res.text().then(uid => {
                        setUserId(uid);
                        onLoginSuccess();
                    });
                } else {
                    if(userId !== null) logout();
                }
            })
    }, [userId, logout, onLoginSuccess]);

    return [userId, login, logout];
}

export function createNewUser(userid, password, onSuccess, onFailure) {
    fetch(`/api/user/new?id=${userid}&pswd=${password}`, {method: 'POST'})
        .then(res => {
            if(res.status === 200) {
                onSuccess(userid, password);
            } else {
                onFailure(res.status === 400);
            }
        });
}

export function useTeledata(initial, onUnauth, onError) {
    const updateTimer = React.useRef(1);
    const numEmptyUpdates = React.useRef(0);

    const [state, apply] = React.useReducer(
        (old_state, patch) => {
            // console.log('reduce', old_state, patch);
            if(patch.clearosp !== undefined)
                return { data: old_state.data, outstanding_patch: [], version: patch.clearosp };
            if(patch.init !== undefined) {
                return {data: patch.init.data, version: patch.init.version, outstanding_patch: []};
            }
            if(patch.server_patch !== undefined) {
                if(old_state.outstanding_patch.length !== 0) console.log('!!!');
                return {
                    data: jsonPatch.apply(oo.clone(old_state.data), patch.server_patch.patch).doc,
                    outstanding_patch: [],
                    version: patch.server_patch.version
                };
            }
            try {
            return {
                data: jsonPatch.apply(oo.clone(old_state.data), patch).doc,
                outstanding_patch: smartPatchMerge(old_state.outstanding_patch, patch),
                version: old_state.version
            };
            } catch(e) {
                console.log(e, patch);
                updateTimer.current = 0;
                return old_state;
            }
        },
        {data: initial, outstanding_patch: [], version: -1}
    );

    const syncOutstanding = React.useCallback(() => {
        updateTimer.current = updateTimer.current - 1;
        if(updateTimer.current > 0) return;
        if(state.outstanding_patch.length === 0) {
            // console.log(`ut ${updateTimer.current} neu ${numEmptyUpdates.current}`);
            updateTimer.current = 1000000; //don't update until the fetch completes
            fetch('/api/data?client_version='+state.version)
                .then(res => {
                    if(res.status !== 200) throw res;
                    return res.json();
                })
                .then(res => {
                    if(res !== null) {
                        if(res.data !== undefined) {
                            apply({init: res});
                            numEmptyUpdates.current = 0;
                            updateTimer.current = 0;
                        } else if(res.patch !== undefined) {
                            apply({server_patch: res});
                            numEmptyUpdates.current = 0;
                            updateTimer.current = 0;
                        } else {
                            throw res;
                        }
                    } else {
                        updateTimer.current = Math.min(Math.pow(2, numEmptyUpdates.current), 128);
                        numEmptyUpdates.current += 1;
                    }
                })
                .catch(e => {
                    numEmptyUpdates.current = 0;
                    updateTimer.current = 50;
                    if(e.status === 401) {
                        console.log('deauth');
                        onUnauth();
                    } else {
                        console.log(e);
                        if(onError) onError(e);
                    }
                });
        } else {
            fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.outstanding_patch)
            })
                .then(res => { if(res.status !== 200) throw res; return res.json(); })
                .then(ver => {
                    updateTimer.current = 1;
                    apply({clearosp: ver.version});
                })
                .catch(e => {
                    console.log(e);
                    updateTimer.current = 50;
                    //apply({clearosp: state.version});
                });
        }
    }, [state.outstanding_patch, state.version, onUnauth, onError]);

    React.useEffect(() => {
        window.addEventListener('unload', syncOutstanding);
        const loop = setInterval(syncOutstanding, 200);
        syncOutstanding(); // get initial data from server
        return () => {
            window.removeEventListener('unload', syncOutstanding);
            clearInterval(loop);
        };
    }, [state.outstanding_patch, syncOutstanding, apply]);

    return [state.data, apply, state.outstanding_patch.length, state.version];
}

export function cdapply(apply, newroot) {
    return (args) => {
        return apply(args.map(p => ({ ...p, path: p.path === '/' ? newroot : `${newroot}${p.path}`})));
    };
}


