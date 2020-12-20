import React from 'react';
import './App.css';
import jsonPatch from 'json8-patch';
import oo from 'json8';

function smartPatchMerge(src_a, src_b) {
    // you could probably skip add/remove pairs that canceled out, but that would be tricky for questionable benefit
    let main = oo.clone(src_a);
    src_b.forEach((patch) => {
        if(patch.op == 'replace') {
            let existing = main.find(p => p.op == 'replace' && p.path == patch.path);
            if(existing) existing.value = patch.value;
            else main.push(patch);
        } else {
            main.push(patch);
        }
    });
    return main;
}

function useData(initial) {
    const [state, apply] = React.useReducer(
        (old_state, patch) => {
            if(patch.clearosp !== undefined) return { data: old_state.data, outstanding_patch: [], version: patch.clearosp };
            if(patch.init != undefined) { return {data: patch.init.data, version: patch.init.version, outstanding_patch: []}; }
            // console.log('reduce', old_state, patch);
            return {
                data: jsonPatch.apply(oo.clone(old_state.data), patch).doc,
                outstanding_patch: smartPatchMerge(old_state.outstanding_patch, patch),
                version: old_state.version
            };
        },
        {data: initial, outstanding_patch: [], version: -1}
    );

    React.useEffect(() => {
        fetch('/api/user/0/data')
            .then(res => res.json())
            .then(data => { apply({init: data}); });
    }, [apply]);

    const updateTimer = React.useRef(1);
    const numEmptyUpdates = React.useRef(0);

    function syncOutstanding() {
        if(state.outstanding_patch.length == 0) {
            // console.log(`ut ${updateTimer.current} neu ${numEmptyUpdates.current}`);
            updateTimer.current = updateTimer.current - 1;
            if(updateTimer.current <= 0) {
                updateTimer.current = 1000000; //don't update until the fetch completes
                fetch('/api/user/0/update_data?version='+state.version)
                    .then(res => {
                        if(res.status != 200) throw res;
                        return res.json();
                    })
                    .then(res => {
                        if(res != null && res.data != undefined) {
                            apply({init: res});
                            numEmptyUpdates.current = 0;
                            updateTimer.current = 0;
                        } else {
                            updateTimer.current = Math.min(Math.pow(2, numEmptyUpdates.current), 32);
                            numEmptyUpdates.current += 1;
                        }
                    })
                    .catch(e => {
                        numEmptyUpdates.current = 0;
                        updateTimer.current = 10;
                        console.log(e);
                    });
            }
            return;
        }
        fetch('/api/user/0/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.outstanding_patch)
        })
            .then(res => { if(res.status != 200) throw res; return res.json(); })
            .then(ver => apply({clearosp: ver.version}))
            .catch(e => {
                console.log(e);
                apply({clearosp: state.version});
            });
    }

    React.useEffect(() => {
        window.addEventListener('unload', syncOutstanding);
        const loop = setInterval(syncOutstanding, 200);
        return () => {
            window.removeEventListener('unload', syncOutstanding);
            clearInterval(loop);
        };
    }, [state.outstanding_patch, syncOutstanding, apply]);

    return [state.data, apply, state.outstanding_patch.length, state.version];
}

function cdapply(apply, newroot) {
    return (args) => {
        return apply(args.map(p => ({ ...p, path: p.path == '/' ? newroot : `${newroot}${p.path}`})));
    };
}

function ChecklistItem({data: { text, checked }, apply}) {
    return (<div>
        <input type="checkbox" checked={checked} onChange={(e) => apply([{
            op: 'replace', path: '/checked', value: !checked
        }])}/>
        <input type="text" value={text} onChange={(e) => apply([{
            op: 'replace', path: '/text', value: e.target.value
        }])}/>
        <button onClick={() => apply([{ op: 'remove', path: '/' }])}>delete</button>
    </div>);
}

function App() {
    const [data, apply, unsync_size, ver] = useData({items: []});
    const [newItemText, setNewItemText] = React.useState('');

    if(data === undefined) return 'data == undefined';

    return (
        <div className="App">
            <div>
                <input type="text" value={newItemText} placeholder="new item..."
                    onChange={(e) => setNewItemText(e.target.value)}/>
                <button onClick={() => {
                    apply([{
                        op: 'add', path: '/items/-', value: { text: newItemText, checked: false }
                    }]); 
                    setNewItemText('');
                }}>+</button>
            </div>
            <div>
                {data.items.map((it, ix) => <ChecklistItem key={ix} data={it} apply={cdapply(apply, `/items/${ix}`)}/>)}
            </div>
            <p style={{fontSize: 'small', fontStyle: 'italic'}}>Number of unsynchronized patches: {unsync_size}</p>
            <p style={{fontSize: 'small', fontStyle: 'italic'}}>Current data version: {ver}</p>
        </div>
    );
}

export default App;
