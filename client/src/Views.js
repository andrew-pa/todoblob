import React from 'react';
import Fuse from 'fuse.js';
import { usePatchableState, cdapply } from './Transport';
import { today, addDays, dateToStr, strToDate, TagEdit, dayNames } from './Common';
import { ChecklistItem, NewItemEdit } from './Item';
import { DayTodoList, SuggestionList } from './Lists';


export function SingleDayView({data, apply}) {
    const [currentDate, setCurrentDate] = React.useState(today());
    const [showSug, setShowSug] = React.useState(true);

    const isSmallDisplay = React.useMemo(() => window.innerWidth < 500 || false, [window.innerWidth]);

    function suggestionButton() {
        return <button onClick={() => setShowSug(!showSug)}>{showSug?'Hide':'Show'} suggestions</button>;
    }

    return (
        <div className="App" style={{width: '80vw', justifySelf: 'center'}}>
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
                {showSug && <SuggestionList data={data} apply={apply} forDate={currentDate}/>}
                <DayTodoList data={data} apply={apply} currentDate={currentDate} smallItems={isSmallDisplay}/>

                {isSmallDisplay && suggestionButton()}
        </div>
    );
}

export function WeekView({data, apply}) {
    const [currentDate, setCurrentDate] = React.useState(today());

    const dates = React.useMemo(() => [-3, -2, -1, 0, 1, 2, 3].map(i => addDays(currentDate, i)), [currentDate]);

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
                {dates.map(date => (<div className="WeekViewCol">
                    <h3>
                        <span style={{paddingRight: '0.3em', color: '#555', fontWeight: 'lighter'}}>
                            {dayNames[date.getDay()]}</span>
                        {date.toLocaleDateString()}</h3>
                    <DayTodoList data={data} apply={apply} currentDate={date} smallItems={true}/>
                </div>))}
            </div>
        </div>
    );
}

export function SearchView({data, apply}) {
    const [query, setQuery] = React.useState('');
    const [queryTags, applyQueryTags] = usePatchableState([]);

    const itemsSearcher = React.useMemo(() => new Fuse(data.items, { keys: [ 'text', 'tags' ] }), [data.items]);
    const items = React.useMemo(() => {
        let fzres = itemsSearcher.search(query);
        if(fzres.length === 0) {
            fzres = data.items.map((v,i) => ({ item: v, refIndex: i }));
        }
        if(queryTags.length > 0) {
            fzres = fzres.filter(i =>
                i.item.tags.reduce((a, v) => a||(queryTags.indexOf(v)!==-1), false));
        }
        function score_item({checked, duedate}) {
            return (duedate?strToDate(duedate).getTime():1) * checked?-1:1;
        }
        return fzres.sort((a, b) => {
            return score_item(b.item) - score_item(a.item);
        });
    }, [query, queryTags, itemsSearcher, data.items]);

    const isSmallDisplay = React.useMemo(() => window.innerWidth < 500 || false, [window.innerWidth]);

    return (
        <div className="App" style={{width: '70%', justifySelf: 'center'}}>
            <div style={{display: 'flex', alignItems: 'center', flexWrap: 'wrap'}}>
                <span style={{padding: '0.25em'}}>search:</span>
                <input type="text" style={{flexGrow: 1, fontSize: 'medium'}} placeholder="keywords..."
                value={query} onChange={(e) => setQuery(e.target.value)}/>
                <span style={{padding: '0.25em'}}>with tags:</span>
                <TagEdit tags={queryTags} apply={applyQueryTags} placeholder="tags..."/>
            </div>
            <div className="TodoList">
                {items.map(it =>
                    <ChecklistItem key={it.refIndex} data={it.item}
                        apply={cdapply(apply, `/items/${it.refIndex}`)} small={false}/>)}
                    <hr/>
                    <NewItemEdit data={data} apply={apply}
                        modAsgDate={dateToStr(today())}
                        itemTags={[queryTags, applyQueryTags]} small={isSmallDisplay}/>
            </div>
        </div>
    );
}


