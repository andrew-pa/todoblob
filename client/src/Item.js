import React from 'react';
import { usePatchableState, cdapply } from './Transport';
import { DAY_IN_TIME, dateToStr, strToDate, TagEdit, Checkbox, computeDueDateColor, newItem } from './Common';

export function ChecklistItem({data: { text, checked, duedate, assigned_day, tags }, apply, small}) {
    const [showDetails, setShowDetails] = React.useState(false);

    function controls() {
        return (<>

            <TagEdit tags={tags} apply={cdapply(apply,'/tags')} placeholder="no tags"/>

            <button onClick={() => apply([{ op: 'remove', path: '/' }])}>✖</button>
            <button onClick={() => { var d = strToDate(assigned_day);  apply([{
                op: 'replace',
                path: '/assigned_day',
                value: dateToStr(new Date(d.getTime() + DAY_IN_TIME))
            }]); }}>→</button>

        </>);
    }

    return (<div className="ItemCont">
        <div className="Item">
            <Checkbox checked={checked} onChange={() => apply([{
                op: 'replace', path: '/checked', value: !checked
            }])}/>
            <input type="text" value={text} style={{flexGrow: 1}} onChange={(e) => apply([{
                op: 'replace', path: '/text', value: e.target.value
            }])}/>
            <input type="date" value={duedate} style={{color: computeDueDateColor(duedate)}} onChange={(e) => apply([{
                op: duedate===undefined?'add':'replace', path: '/duedate', value: e.target.value
            }])}/>

            <div>
                {!small && controls()}
                <button onClick={() => setShowDetails(!showDetails)}>⋮</button>
            </div>
        </div>

        <div className="Item" style={{display: showDetails?'unset':'none'}}>
            <span>assigned day:</span>
            <input type="date" value={assigned_day} required style={{maxWidth: 'min-content'}} onChange={(e) => apply([{
                op: 'replace', path: '/assigned_day', value: e.target.value
            }])}/>
            {small && controls()}
        </div>
    </div>);
}

export function NewItemEdit({ apply, small, itemProps, itemTags, modAsgDate }) {
    const [newItemText, setNewItemText] = React.useState('');
    const [newItemDueDate, setNewItemDueDate] = React.useState('');
    const [newItemAsgDate, setNewItemAsgDate] = React.useState(modAsgDate);
    let [newItemTags, applyNewItemTags] = usePatchableState([]);
    if(itemTags !== undefined) {
        [newItemTags, applyNewItemTags] = itemTags;
    }

    function addItem() {
        apply([{
            op: 'add', path: '/items/-',
            value: newItem({
                text: newItemText, duedate: newItemDueDate, tags: newItemTags,
                ...(modAsgDate !== undefined ? { assigned_day: newItemAsgDate } : {}),
                ...(itemProps||{})
            })
        }]); 
        setNewItemText('');
    }

    function onKeyDown(e) {
        if(e.key === 'Enter') addItem();
    }

    return (
        <div className="ItemCont">
            <div className="Item">
                <input type="text" value={newItemText} placeholder="new item..."
                    style={{flexGrow: '1'}}
                    onKeyDown={onKeyDown}
                    onChange={(e) => setNewItemText(e.target.value)}/>
                {!small && (modAsgDate!==undefined) && <input type="date" value={newItemAsgDate} onChange={(e) => setNewItemAsgDate(e.target.value)}/>}
                {!small && <input type="date" value={newItemDueDate} onChange={(e) => setNewItemDueDate(e.target.value)}/>}
                {!small && <TagEdit tags={newItemTags} apply={applyNewItemTags} placeholder="tags..."/>}
                <button onClick={addItem}>+</button>
            </div>
       </div>
    );
     
}


