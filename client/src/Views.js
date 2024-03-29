/* eslint-disable no-unused-vars, eqeqeq, react-hooks/exhaustive-deps */
import React from 'react';
import Fuse from 'fuse.js';
import { usePatchableState, cdapply } from './Transport';
import { today, addDays, dateToStr, strToDate, TagEdit, dayNames, Checkbox, TagContext } from './Common';
import { ChecklistItem, NewItemEdit } from './Item';
import { DayTodoList, SuggestionList } from './Lists';


export function SingleDayView({data, apply}) {
    const [currentDate, setCurrentDate] = React.useState(today());
    const [showSug, setShowSug] = React.useState(false);

    const isSmallDisplay = React.useMemo(() => window.innerWidth < 500 || false, [window.innerWidth]);

    function suggestionButton() {
        return <button onClick={() => setShowSug(!showSug)}>{showSug?'Hide':'Show'} suggestions</button>;
    }

    return (
        <div className="App">
            <div className="DateTitle">
                {!isSmallDisplay && suggestionButton()}
                <button onClick={() => setCurrentDate(addDays(currentDate, -1))}>◀</button>
                <input className="CurrentDate" type="date" value={dateToStr(currentDate)}
                    onChange={(e) => setCurrentDate(strToDate(e.target.value))} required/>
                <div>
                    <button onClick={() => setCurrentDate(today())}>Today</button>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))}>▶</button>
                </div>
            </div>
                {isSmallDisplay && suggestionButton()}
                {showSug && <SuggestionList data={data} apply={apply} forDate={currentDate}/>}
                <DayTodoList data={data} apply={apply} currentDate={currentDate} smallItems={isSmallDisplay}/>
        </div>
    );
}

export function WeekView({data, apply}) {
    const [currentDate, setCurrentDate] = React.useState(today());

    const dates = React.useMemo(() => [-3, -2, -1, 0, 1, 2, 3, 4, 5].map(i => addDays(currentDate, i)), [currentDate]);

    return (
        <div className="App">
            <div className="DateTitle">
                <button onClick={() => setCurrentDate(addDays(currentDate, -7))}>◀</button>
                <input className="CurrentDate" type="date" value={dateToStr(currentDate)}
                    onChange={(e) => setCurrentDate(strToDate(e.target.value))} required/>
                <div>
                    <button onClick={() => setCurrentDate(today())}>Today</button>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 7))}>▶</button>
                </div>
            </div>
            <div className="WeekView">
                {dates.map((date, i) => (<div className="WeekViewCol" key={i}>
                    <h3>
                        <span style={{paddingRight: '0.3em', ...(i==3?{color: 'purple', 'fontWeight':'bold'}:{'fontWeight':'lighter', color: 'gray'}) }}>
                            {dayNames[date.getDay()]}</span>
                        {date.toLocaleDateString()}</h3>
                    <DayTodoList data={data} apply={apply} currentDate={date} smallItems={true}/>
                </div>))}
            </div>
        </div>
    );
}

export function CheckboxMultistate({ state, numStates, symbols, onChange }) {
    return (
        <div className="Checkbox" onClick={() => onChange((state+1) % numStates)}>
            <span style={{display: state>0?'contents':'none'}}>{symbols[state]}</span>
        </div>
    );
}

export function SearchView({data, apply}) {
    const [query, setQuery] = React.useState('');
    const [queryTags, applyQueryTags] = usePatchableState([]);
    const [checkStateQ, setCheckStateQ] = React.useState(2);

    const itemsSearcher = React.useMemo(() => new Fuse(data.items, { keys: [ 'text', 'tags' ] }), [data.items]);
    const items = React.useMemo(() => {
        let fzres = itemsSearcher.search(query);
        if(fzres.length === 0) {
            fzres = data.items.map((v,i) => ({ item: v, refIndex: i }));
        }
        if(queryTags.length > 0) {
            fzres = fzres.filter(i =>
                queryTags.reduce((a, v) => a&&(i.item.tags.indexOf(v)!==-1), true));
        }
        if(checkStateQ != 2) {
            fzres = fzres.filter(i => checkStateQ == 1 ? i.item.checked : !i.item.checked);
        }
        function score_item({checked, duedate}) {
            return (duedate?strToDate(duedate).getTime():1) * checked?-1:1;
        }
        return fzres.sort((a, b) => {
            return score_item(b.item) - score_item(a.item);
        });
    }, [query, queryTags, checkStateQ, itemsSearcher, data.items]);

    const isSmallDisplay = React.useMemo(() => window.innerWidth < 500 || false, [window.innerWidth]);

    function deleteMatches() {
        if(window.confirm("confirm delete?")) {
            apply(items.map(i => ({ op: 'remove', path: `/items/${i.refIndex}` })).reverse());
        }
    }

    return (
        <div className="App">
            <div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap'}}>
                <span style={{padding: '0.25em'}}>search:</span>
                <input type="text" style={{flexGrow: 1, fontSize: 'medium'}} placeholder="keywords..."
                value={query} onChange={(e) => setQuery(e.target.value)}/>
                <span style={{padding: '0.25em'}}>with tags:</span>
                <TagEdit tags={queryTags} apply={applyQueryTags} placeholder="tags..."/>
                <span style={{padding: '0.25em'}}>state:</span>
                <CheckboxMultistate state={checkStateQ} numStates={3} symbols={[' ', '✓', '?']} onChange={(s) => setCheckStateQ(s)}/>
            </div>
            <div className="TodoList">
                {items.map(it =>
                    <ChecklistItem key={it.refIndex} data={it.item}
                        apply={cdapply(apply, `/items/${it.refIndex}`)}
                        small={isSmallDisplay}/>)}
                    <hr/>
                    <NewItemEdit data={data} apply={apply}
                        modAsgDate={dateToStr(today())}
                        itemTags={[queryTags, applyQueryTags]} small={isSmallDisplay}/>
            </div>
            <button onClick={deleteMatches}>Delete matches</button>
        </div>
    );
}

export function UserView({data, apply}) {
    let {tags: possibleTags, applyTags: applyPossibleTags} = React.useContext(TagContext);

    return (<div className="App">
        {possibleTags && <>
        <span>Tag suggestion list:</span>
        <TagEdit tags={possibleTags} apply={applyPossibleTags}
            placeholder="no tags"
            onSubmit={()=>{}}/></>}
    </div>);
}
