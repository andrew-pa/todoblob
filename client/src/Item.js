import React from 'react';
import { usePatchableState, cdapply } from './Transport';
import { DAY_IN_TIME, dateToStr, strToDate, TagEdit, Checkbox, computeDueDateColor, newItem, WeekdaySelector, nextAssignedDay, today } from './Common';
import TextareaAutosize from 'react-textarea-autosize';

export function ChecklistItem({data: { text, checked, duedate, assigned_day, tags, reoccuring_assignment, subitems }, apply, small}) {
    const [showDetails, setShowDetails] = React.useState(false);
    const [newItemText, setNewItemText] = React.useState('');

    function controls() {
        return (<>

            <input type="date" value={duedate} style={{color: computeDueDateColor(duedate)}} onChange={(e) => apply([{
                op: duedate===undefined?'add':'replace', path: '/duedate', value: e.target.value
            }])}/>

            <TagEdit tags={tags} apply={cdapply(apply,'/tags')} placeholder="no tags"/>

            <button onClick={() => apply([{ op: 'remove', path: '/' }])}>✖</button>
            <button onClick={() => { var d = strToDate(assigned_day);  apply([{
                op: 'replace',
                path: '/assigned_day',
                value: dateToStr(new Date(d.getTime() + DAY_IN_TIME))
            }]); }}>→</button>

        </>);
    }

    function checkOffItem() {
        if(reoccuring_assignment !== undefined) {
            if(duedate !== undefined && duedate !== '') {
                // if today was or is past the duedate for this item, just check it off since it is completed
                const now = today().getTime();
                const due = (strToDate(duedate)).getTime();
                if(now >= due || now <= due+DAY_IN_TIME/2) {
                    apply([{
                        op: 'replace', path: '/checked', value: !checked
                    }]);
                    return;
                }
            }
            // otherwise move this item to the next assigned day
            apply([{
                op: 'replace', path: '/assigned_day', value: dateToStr(nextAssignedDay(assigned_day, reoccuring_assignment))
            }]);
            return;
        }

        apply([{
            op: 'replace', path: '/checked', value: !checked
        }]);
    }

    function addSubitem() {
        var patch = [];
        var item = { text: newItemText, checked: false };
        if(subitems === undefined) {
            patch.push({
                op: 'add', path: '/subitems', value: [item]
            });
        } else {
            patch.push({
                op: 'add', path: '/subitems/-', value: item
            });
        }
        apply(patch);
        setNewItemText('');
    }

    const subitemStats = React.useMemo(() => {
        if(subitems) {
            return { total: subitems.length, checked: subitems.reduce((pv, item) => pv + (item.checked?1:0), 0) }
        } else {
            return null;
        }
    }, [subitems]);

    return (<div className="ItemCont">
        <div className="Item">
            <Checkbox checked={checked} onChange={checkOffItem}/>
            {subitemStats && subitemStats.total > 0 && <span><span style={{position: 'relative', bottom: '0.4em', backgroundColor: 'transparent', fontSize: 'small'}}>{subitemStats.checked}</span>⁄
                                                             <span style={{position: 'relative', top: '0.4em', backgroundColor: 'transparent', fontSize: 'small'}}>{subitemStats.total}</span></span>}
            <TextareaAutosize value={text} style={{flexGrow: 1, overflowY: showDetails?'scroll':'hidden'}} maxRows={showDetails?12:2} onChange={(e) => apply([{
                op: 'replace', path: '/text', value: e.target.value
            }])}/>

            <div>
                {!small && controls()}
                <button onClick={() => setShowDetails(!showDetails)}>⋮</button>
            </div>
        </div>

        <div className="Item" style={{display: showDetails?'flex':'none', justifyContent: 'flex-start', marginLeft: '0.5em', marginBottom: '0.5em'}}>
            {small && controls()}
            <div><span>assigned:</span>
            <input type="date" value={assigned_day} required style={{maxWidth: 'min-content'}} onChange={(e) => apply([{
                op: 'replace', path: '/assigned_day', value: e.target.value
            }])}/></div>
            <div>
            <span style={{textAlign: "left"}}>reoccuring:</span>
            <input type="checkbox" checked={reoccuring_assignment!==undefined?true:false} onChange={(e) => {
                if(e.target.checked) {
                    apply([{
                        op: reoccuring_assignment===undefined?'add':'replace', path: '/reoccuring_assignment',
                        value: []
                    }])
                } else {
                    apply([{ op: 'remove', path: '/reoccuring_assignment' }]);
                }
            }}/>
            {reoccuring_assignment!==undefined &&
                <WeekdaySelector value={reoccuring_assignment} onChange={(n) => apply([{
                    op: 'replace', path: '/reoccuring_assignment', value: n
                }])}/>}
            </div>
        </div>

        {showDetails && subitems && subitems.map((item, index) => (<div className="Item" key={index} style={{marginLeft: '0.5em', marginRight: '0.5em'}}>
            <Checkbox checked={item.checked} onChange={() => apply([{
                op: 'replace', path: `/subitems/${index}/checked`, value: !item.checked
            }])}/>
            <TextareaAutosize value={item.text} style={{flexGrow: 1}} maxRows={5} onChange={(e) => apply([{
                op: 'replace', path: `/subitems/${index}/text`, value: e.target.value
            }])}/>
            <button onClick={() => apply([{ op: 'remove', path: `/subitems/${index}` }])}>✖</button>
        </div>))}
        
        <div className="Item" style={{display: showDetails?'flex':'none', marginLeft: '0.5em', marginRight: '0.5em'}}>
            <input type="text" value={newItemText} placeholder="new subitem..."
                style={{flexGrow: '1'}}
                onKeyDown={(e) => { if(e.key==='Enter') addSubitem(); }}
                onChange={(e) => setNewItemText(e.target.value)} />
            <button onClick={addSubitem}>+</button>
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
        if(e.key === 'Enter' && e.shiftKey) addItem();
    }

    return (
        <div className="ItemCont">
            <div className="Item">
                <TextareaAutosize value={newItemText} placeholder="new item..."
                    style={{flexGrow: '1'}}
                    onKeyDown={onKeyDown}
                    onChange={(e) => setNewItemText(e.target.value)}/>
                {!small && (modAsgDate!==undefined) && <input type="date" value={newItemAsgDate} onChange={(e) => setNewItemAsgDate(e.target.value)}/>}
                {!small && <input type="date" value={newItemDueDate} onChange={(e) => setNewItemDueDate(e.target.value)}/>}
                {!small && <TagEdit tags={newItemTags} apply={applyNewItemTags} onSubmit={addItem} placeholder="tags..."/>}
                <button onClick={addItem}>+</button>
            </div>
       </div>
    );
     
}


