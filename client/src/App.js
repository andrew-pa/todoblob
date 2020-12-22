import React from 'react';
import './App.css';
import { useTeledata, cdapply } from './Transport.js';
import { BrowserRouter as Router, Switch, Route, Link, NavLink, Redirect } from 'react-router-dom';

/*
 * suggestions
 * week view
 * search
 * tags
 * backend db
 */

const DAY_IN_TIME = (1000 * 3600 * 24);

function Checkbox({ checked, onChange }) {
    return (<div className="Checkbox" onClick={() => onChange()}>
        <span style={{display: checked?'contents':'none'}}>✓</span>
        </div>);
}

function dateToStr(date) {
    if(!date) return null;
    return date.toISOString().substr(0,10);
}

function strToDate(str) {
    const re = /(\d\d\d\d)-(\d\d)-(\d\d)/;
    let ma = re.exec(str);
    return new Date(parseInt(ma[1]), parseInt(ma[2])-1, parseInt(ma[3]));
}

function today() {
    let d = new Date();
    d.setHours(0); d.setMinutes(0);
    d.setSeconds(0); d.setMilliseconds(0);
    return d;
}

function computeDueDateColor(duedate) {
    if(!duedate) return 'black';
    const now = today().getTime();
    const due = (strToDate(duedate)).getTime();
    if(now >= due && now <= due+DAY_IN_TIME) {
        return 'rgb(230,120,0)'
    } else if(now > due) {
        return 'red';
    } else if(now < due) {
        return 'black';
    }
}

function ChecklistItem({data: { text, checked, duedate, assigned_day }, apply, small}) {
    const [showDetails, setShowDetails] = React.useState(false);

    function controls() {
        return (<>
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
                <button onClick={() => setShowDetails(!showDetails)}>⋮</button>
                {!small && controls()}
            </div>
        </div>

        <div className="Item" style={{display: showDetails?'unset':'none'}}>
            <span>assigned day:</span>
            <input type="date" value={assigned_day} style={{maxWidth: 'min-content'}} onChange={(e) => apply([{
                op: 'replace', path: '/assigned_day', value: e.target.value
            }])}/>
            {small && controls()}
        </div>
    </div>);
}

function DayTodoList({data, apply, currentDate, smallItems}) {
    const [newItemText, setNewItemText] = React.useState('');

    const [checkedItems, uncheckedItems] = React.useMemo(() => {
            const curDateS = dateToStr(currentDate);
            let items = data.items
                .map((item, index) => { item.index = index; return item; })
                .filter(item => curDateS == item.assigned_day);
            return [items.filter(i => i.checked), items.filter(i => !i.checked)];
        },
        [data.items, currentDate]);

    return (
        <div className="TodoList">
            {uncheckedItems.map(it =>
                <ChecklistItem key={it.index} data={it} apply={cdapply(apply, `/items/${it.index}`)} small={smallItems}/>)}

            <div className="ItemCont">
                <div className="Item">
                <input type="text" value={newItemText} placeholder="new item..."
                    style={{width: '100%'}}
                    onChange={(e) => setNewItemText(e.target.value)}/>
                <button onClick={() => {
                    apply([{
                        op: 'add', path: '/items/-',
                        value: { text: newItemText, checked: false, duedate: null, assigned_day: dateToStr(currentDate) }
                    }]); 
                    setNewItemText('');
                }}>+</button>
                </div>
            </div>
            {checkedItems.length > 0 && <hr/>}

            {checkedItems.map(it =>
                <ChecklistItem key={it.index} data={it} apply={cdapply(apply, `/items/${it.index}`)} small={smallItems}/>)}
        </div>
    );
}

function SuggestionList({data, apply, forDate}) {
    const items = React.useMemo(() => {
        return data.items
            .map((item, index) => { item.index = index; return item; })
            .filter(item => {
                if(item.checked) return false;
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
                }])}>🡆</button>
            </div>
        );
    }

    return (
        <div className="TodoList">
            {items.map(item => <SuggestionItem key={item.index} data={item} apply={cdapply(apply, `/items/${item.index}`)}/>)}
            <hr/>
        </div>
    );
}

function addDays(currentDate, incr) {
    return new Date(currentDate.getTime() + DAY_IN_TIME*incr);
}


function SingleDayView({data, apply}) {
    const [currentDate, setCurrentDate] = React.useState(today());
    const [showSug, setShowSug] = React.useState(true);
    return (
        <div className="App" style={{width: '70%', justifySelf: 'center'}}>
            <div className="DateTitle">
                <button onClick={() => setShowSug(!showSug)}>{showSug?'Hide':'Show'} suggestions</button>
                <button onClick={() => setCurrentDate(addDays(currentDate, -1))}>◀</button>
                <input className="CurrentDate" type="date" value={dateToStr(currentDate)}
                    onChange={(e) => setCurrentDate(strToDate(e.target.value))} required/>
                <div>
                    <button onClick={() => setCurrentDate(today())}>Today</button>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))}>▶</button>
                </div>
            </div>
                {showSug && <SuggestionList data={data} apply={apply} forDate={currentDate}/>}
                <DayTodoList data={data} apply={apply} currentDate={currentDate} smallItems={false}/>
        </div>
    );
}

function WeekView({data, apply}) {
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
                    <h3>{date.toLocaleDateString()}</h3>
                    <DayTodoList data={data} apply={apply} currentDate={date} smallItems={true}/>
                </div>))}
            </div>
        </div>
    );
}

function App() {
    const [data, apply, unsync_size, ver] = useTeledata({items: []});

    return (
        <Router>
            <div className="Page">
            <div className="Header">
                <span>Todos</span>
                <NavLink to="/day" activeClassName="current">by day</NavLink>
                <NavLink to="/week" activeClassName="current">by week</NavLink>

            </div>

            <Switch>
                <Route path="/day">
                    <SingleDayView data={data} apply={apply}/>
                </Route>
                <Route path="/week">
                    <WeekView data={data} apply={apply}/>
                </Route>
                <Route exact path="/">
                    <Redirect to="/day"/>
                </Route>
            </Switch>

            <p className="Footer" style={{fontSize: 'small', fontStyle: 'italic', textAlign: 'center', color: '#aaa'}}>
                Unsynchronized patches: {unsync_size} &mdash; Data version: {ver}
            </p>
            </div>

        </Router>
    );
}

export default App;
