import React from 'react';
import Fuse from 'fuse.js';

export const DAY_IN_TIME = (1000 * 3600 * 24);
export const APP_NAME = 'Todoblob';

export function Checkbox({ checked, onChange }) {
    return (
        <div className="Checkbox" onClick={() => onChange()}>
            <span style={{display: checked?'contents':'none'}}>✓</span>
        </div>
    );
}

export function dateToStr(date) {
    if(!date) return null;
    return date.toISOString().substr(0,10);
}

export function strToDate(str) {
    const re = /(\d\d\d\d)-(\d\d)-(\d\d)/;
    let ma = re.exec(str);
    if(!ma) console.log(str, ma);
    return new Date(parseInt(ma[1]), parseInt(ma[2])-1, parseInt(ma[3]));
}

export function today() {
    let d = new Date();
    d.setHours(0); d.setMinutes(0);
    d.setSeconds(0); d.setMilliseconds(0);
    return d;
}

export function addDays(currentDate, incr) {
    return new Date(currentDate.getTime() + DAY_IN_TIME*incr);
}

export const dayNames = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
export function nextAssignedDay(current, reoccurance) {
    console.log(current, reoccurance);
    let current_date = strToDate(current);
    let current_day = current_date.getDay();
    // find where we are in the reoccurance, making sure to not go into the future
    let current_reoc_step = -1;
    for(var di = 0; di < reoccurance.length; ++di) {
        let i = reoccurance[di];
        console.log(di, i, current_reoc_step);
        if(i > current_day)
            break;
        current_reoc_step = di;
        if(current_day === i) break;
    }
    let delta = reoccurance[(current_reoc_step+1) % reoccurance.length] - current_day;
    console.log(current_day, current_reoc_step, dayNames[reoccurance[current_reoc_step]], dayNames[reoccurance[(current_reoc_step+1) % reoccurance.length]], delta);
    if(delta < 0) delta += 7;
    return new Date(current_date.getFullYear(), current_date.getMonth(),
        current_date.getDate() + delta);
}

export function computeDueDateColor(duedate) {
    if(!duedate) return 'black';
    const now = today().getTime();
    const due = (strToDate(duedate)).getTime();
    if(now >= due && now <= due+DAY_IN_TIME/2) {
        return 'rgb(230,120,0)';
    } else if(now > due) {
        return 'red';
    } else if(now < due) {
        return 'black';
    }
}

export function newItem(vals) {
    return { text: '', checked: false, duedate: null, assigned_day: '2020-12-12', tags: [], ...vals };
}

export const TagContext = React.createContext({ tags: [], applyTags: () => {} });

export function TagEdit({tags, apply, placeholder}) {
    function Tag({text, onClick, symbol}) {
        return (
            <div className="Tag">
                <span>{text}</span><button onClick={onClick}>{symbol||'✖'}</button>
            </div>
        );
    }

    const [curTagTx, setCurTagTx] = React.useState('');

    let {tags: possibleTags, applyTags: applyPossibleTags} = React.useContext(TagContext);
    possibleTags = possibleTags || [];

    const tagSugGen = React.useMemo(() => new Fuse(possibleTags.filter(tag => tags.indexOf(tag) === -1)), [possibleTags, tags]);
    const tagSugs   = React.useMemo(() => tagSugGen.search(curTagTx), [tagSugGen, curTagTx]);

    function addTag(tag) {
        if(tags.indexOf(tag) !== -1) return;
        setCurTagTx('');
        apply([{
            op: 'add', path: '/-', value: tag
        }]);
        if(possibleTags.indexOf(tag) === -1) {
            applyPossibleTags([{
                op: 'add', path: '/-', value: tag
            }]);
        }
    }

    function onKeyDown(e) {
        if(e.key === 'Tab') {
            e.preventDefault();
            if(tagSugs.length>0) addTag(tagSugs[0].item);
        } else if(e.key === 'Enter') {
            e.preventDefault();
            if(curTagTx.length > 0) {
                addTag(curTagTx);
            }
        } else if(e.key === 'Backspace' && curTagTx.length === 0 && tags.length>0) {
            apply([{
                op: 'remove', path: `/${tags.length-1}`
            }]);
        }
    }

    return (
        <div className="TagEdit">
            {tags.length===0 && curTagTx.length === 0 && <span style={{color: 'gray'}}>{placeholder}</span>}
            <>{tags.map((tag, ix) => <Tag key={ix} text={tag} onClick={() => apply([{
                op: 'remove', path: `/${ix}`
            }])}/>)}</>
            <div style={{position: 'relative', flexGrow: '1', maxWidth: 'max-content'}}>
            <input type="text"
                value={curTagTx} onChange={(e) => setCurTagTx(e.target.value)}
                onKeyDown={onKeyDown}/>
            {curTagTx.length > 0 && tagSugs.length > 0 && <div className="TagSugList">
                {tagSugs.map(tag => <Tag key={tag.refIndex} text={tag.item} symbol="+" onClick={() => addTag(tag.item)}/>)}
            </div>}
            </div>
        </div>
    );
}

export function WeekdaySelector({value, onChange}) {

    function toggle(day) {
        if(value.indexOf(day) > -1) {
            value.splice(value.indexOf(day), 1);
            onChange(value.sort((a,b) => a-b));
        } else {
            value.push(day);
            onChange(value.sort((a,b) => a-b));
        }
    }

    return (
        <div className="WeekdaySelector">
            {dayNames.map((day, index) => <span className={value.indexOf(index) > -1 ? 'Day Selected' : 'Day'}
                onClick={() => toggle(index)}>{day}</span>)}
        </div>
    );
}
