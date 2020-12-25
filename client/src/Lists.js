import React from 'react';
import {cdapply} from './Transport';
import { DAY_IN_TIME, dateToStr, strToDate, computeDueDateColor } from './Common';
import { ChecklistItem, NewItemEdit } from './Item';

export function DayTodoList({data, apply, currentDate, smallItems}) {
    const [checkedItems, uncheckedItems] = React.useMemo(() => {
            const curDateS = dateToStr(currentDate);
            let items = data.items
                .map((item, index) => { item.index = index; return item; })
                .filter(item => curDateS === item.assigned_day);
            return [items.filter(i => i.checked), items.filter(i => !i.checked)];
        },
        [data.items, currentDate]);

    return (
        <div className="TodoList">
            {uncheckedItems.map(it =>
                <ChecklistItem key={it.index} data={it} apply={cdapply(apply, `/items/${it.index}`)} small={smallItems}/>)}

            <NewItemEdit data={data} apply={apply} itemProps={{assigned_day: dateToStr(currentDate)}} small={smallItems}/>
            {checkedItems.length > 0 && <hr/>}

            {checkedItems.map(it =>
                <ChecklistItem key={it.index} data={it} apply={cdapply(apply, `/items/${it.index}`)} small={smallItems}/>)}
        </div>
    );
}

export function SuggestionList({data, apply, forDate}) {
    const items = React.useMemo(() => {
        return data.items
            .map((item, index) => { item.index = index; return item; })
            .filter(item => {
                if(item.checked) return false;
                if(!item.assigned_day) {
                    if(item.duedate && Math.abs(strToDate(item.duedate).getTime()-forDate.getTime()) < DAY_IN_TIME*7) return true;
                    return false;
                }
                let idate = strToDate(item.assigned_day);
                if(idate.getTime()+DAY_IN_TIME > forDate.getTime()) return false;
                return true;
             })
            .sort((ai, bi) => ai.duedate&&bi.duedate?(strToDate(ai.duedate).getTime()) - (strToDate(bi.duedate).getTime()) : -1);
    }, [data.items, forDate]);

    function SuggestionItem({data: { text, duedate, assigned_day }, apply}) {
        return (
            <div className="ItemCont Item Suggestion" style={{flexDirection: 'row', border: '1.5px dashed'}}>
                <span>{text}</span>
                <input type="date" required readOnly value={duedate} style={{color: computeDueDateColor(duedate)}}/>
                <input type="date" required readOnly value={assigned_day}/>
                <button onClick={() => apply([{
                    op: 'replace', path: '/assigned_day', value: dateToStr(forDate)
                }])}>🡇</button>
            </div>
        );
    }

    return (
        <div className="TodoList">
            {items.map(item => <SuggestionItem key={item.index} data={item} apply={cdapply(apply, `/items/${item.index}`)}/>)}
            {items.length>0 && <hr/>}
        </div>
    );
}


