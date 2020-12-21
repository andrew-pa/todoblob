import React from 'react';
import './App.css';
import { useTeledata, cdapply } from './Transport.js';

function ChecklistItem({data: { text, checked, duedate }, apply}) {
    return (<div>
        <input type="checkbox" checked={checked} onChange={(e) => apply([{
            op: 'replace', path: '/checked', value: !checked
        }])}/>
        <input type="text" value={text} onChange={(e) => apply([{
            op: 'replace', path: '/text', value: e.target.value
        }])}/>
        <input type="date" value={duedate} onChange={(e) => apply([{
            op: duedate===undefined?'add':'replace', path: '/duedate', value: e.target.value
        }])}/>
        <button onClick={() => apply([{ op: 'remove', path: '/' }])}>delete</button>
    </div>);
}

function App() {
    const [data, apply, unsync_size, ver] = useTeledata({items: []});
    const [newItemText, setNewItemText] = React.useState('');

    return (
        <div className="App">
            <div>
                <input type="text" value={newItemText} placeholder="new item..."
                    onChange={(e) => setNewItemText(e.target.value)}/>
                <button onClick={() => {
                    apply([{
                        op: 'add', path: '/items/-', value: { text: newItemText, checked: false, duedate: null }
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
