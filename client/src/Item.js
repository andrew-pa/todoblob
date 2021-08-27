/* eslint-disable no-unused-vars, eqeqeq */
import React from 'react';
import { usePatchableState, cdapply } from './Transport';
import { DAY_IN_TIME, dateToStr, strToDate, TagEdit, Checkbox, computeDueDateColor, newItem, WeekdaySelector, nextAssignedDay, today } from './Common';
import TextareaAutosize from 'react-textarea-autosize';
import { useDrag, useDrop } from 'react-dnd';

function Subitem({item, apply, listApply, id}) {
    const ref = React.useRef(null);

    const [{handlerId}, drop] = useDrop({
        accept: 'SUBITEM',
        collect(monitor) {
            return {
                handlerId: monitor.getHandlerId()
            };
        },
        hover(otherItem, monitor) {
            if(!ref.current) return;
            const dragIndex = otherItem.index;
            const hoverIndex = item.order;
            if(dragIndex == hoverIndex) return;

            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if(dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if(dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
            // console.log(`drag ${dragIndex} hover ${hoverIndex} self ${item.order}/${id}`);

            // move item dragIndex hoverIndex
            apply([{op: item.order===undefined?'add':'replace', path: '/order', value: dragIndex}]);

            listApply([{op: otherItem.order===undefined?'add':'replace', path: `/${otherItem.id}/order`, value: hoverIndex}]);
            otherItem.index = hoverIndex;
        }
    });

    const [{isDragging}, drag, preview] = useDrag({
        type: 'SUBITEM',
        item: () => ({ id: id, index: item.order }),
        collect: (monitor) => ({
            isDragging: monitor.isDragging()
        })
    });

    drag(drop(ref));

    return (
        <div className="Item" style={{marginLeft: '0.5em', marginRight: '0.5em', opacity: (isDragging?0:1)}} ref={preview}>
            <Checkbox innerRef={ref} checked={item.checked} onChange={() => apply([{
                op: 'replace', path: `/checked`, value: !item.checked
            }])}/>
            <TextareaAutosize value={item.text} style={{flexGrow: 1}} maxRows={5} onChange={(e) => apply([{
                op: 'replace', path: `/text`, value: e.target.value
            }])}/>
            <button onClick={() => apply([{ op: 'remove', path: '/' }])}>✖</button>
        </div>
    );
}

export function SubitemStats({subitems}) {
    const subitemStats = React.useMemo(() => {
        if(subitems) {
            return { total: subitems.length, checked: subitems.reduce((pv, item) => pv + (item.checked?1:0), 0) }
        } else {
            return null;
        }
    }, [subitems]);

    if(!subitemStats || subitemStats.total <= 0)
        return null;

    return (<span style={{flexGrow: 0}}>
        <span style={{position: 'relative', bottom: '0.4em', backgroundColor: 'transparent', fontSize: 'small', margin: 'revert'}}>{subitemStats.checked}</span>
        ⁄
        <span style={{position: 'relative', top: '0.4em', backgroundColor: 'transparent', fontSize: 'small', margin: 'revert'}}>{subitemStats.total}</span>
    </span>);
}

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
            item.order = 0;
            patch.push({
                op: 'add', path: '/subitems', value: [item]
            });
        } else {
            item.order = subitems.length;
            patch.push({
                op: 'add', path: '/subitems/-', value: item
            });
        }
        apply(patch);
        setNewItemText('');
    }

    const subitemsDisplay = React.useMemo(() => {
        if(!showDetails || !subitems) return [];
        return subitems.map((item, id) => ({ item, id }))
            .sort((a, b) => a.item.order - b.item.order);
    }, [subitems, showDetails]);

    return (<div className="ItemCont">
        <div className="Item">
            <Checkbox checked={checked} onChange={checkOffItem}/>
            <SubitemStats subitems={subitems}/>
            <TextareaAutosize value={text} style={{flexGrow: 1, overflowY: showDetails?'scroll':'hidden'}} maxRows={showDetails?12:1} onChange={(e) => apply([{
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

        {showDetails && subitemsDisplay && subitemsDisplay.map(({item, id}) =>
            <Subitem key={id} id={id} item={item} listApply={cdapply(apply, '/subitems')} apply={cdapply(apply, `/subitems/${id}`)}/>)}
        
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


