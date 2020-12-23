import React from 'react';
import './App.css';
import { useTeledata, usePatchableState, useAccount, createNewUser, cdapply } from './Transport.js';
import { BrowserRouter as Router, Switch, Route, NavLink, Redirect, useHistory } from 'react-router-dom';
import Fuse from 'fuse.js';

/*
 + suggestions
 + week view
 + search
 + tags
 + backend db
 * subitems
 + user accounts
 * logged out view
 */

const DAY_IN_TIME = (1000 * 3600 * 24);
const APP_NAME = 'Todoblob';

function Checkbox({ checked, onChange }) {
    return (
        <div className="Checkbox" onClick={() => onChange()}>
            <span style={{display: checked?'contents':'none'}}>✓</span>
        </div>
    );
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
    if(now >= due && now <= due+DAY_IN_TIME/2) {
        return 'rgb(230,120,0)'
    } else if(now > due) {
        return 'red';
    } else if(now < due) {
        return 'black';
    }
}

const TagContext = React.createContext({ tags: [], applyTags: () => {} });

function TagEdit({tags, apply, placeholder}) {
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

    const tagSugGen = React.useMemo(() => new Fuse(possibleTags.filter(tag => tags.indexOf(tag) == -1)), [possibleTags, tags]);
    const tagSugs   = React.useMemo(() => tagSugGen.search(curTagTx), [tagSugGen, curTagTx]);

    function addTag(tag) {
        if(tags.indexOf(tag) != -1) return;
        setCurTagTx('');
        apply([{
            op: 'add', path: '/-', value: tag
        }]);
        if(possibleTags.indexOf(tag) == -1) {
            applyPossibleTags([{
                op: 'add', path: '/-', value: tag
            }]);
        }
    }

    function onKeyDown(e) {
        if(e.key == 'Tab') {
            e.preventDefault();
            if(tagSugs.length>0) addTag(tagSugs[0].item);
        } else if(e.key == 'Enter') {
            e.preventDefault();
            if(curTagTx.length > 0) {
                addTag(curTagTx);
            }
        } else if(e.key == 'Backspace' && curTagTx.length == 0 && tags.length>0) {
            apply([{
                op: 'remove', path: `/${tags.length-1}`
            }]);
        }
    }

    return (
        <div className="TagEdit">
            {tags.length==0 && curTagTx.length == 0 && <span style={{color: 'gray'}}>{placeholder}</span>}
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

function ChecklistItem({data: { text, checked, duedate, assigned_day, tags }, apply, small}) {
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

function newItem(vals) {
    return { text: '', checked: false, duedate: null, assigned_day: '2020-12-12', tags: [], ...vals };
}

function NewItemEdit({ data, apply, small, itemProps, itemTags, modAsgDate }) {
    const [newItemText, setNewItemText] = React.useState('');
    const [newItemDueDate, setNewItemDueDate] = React.useState(null);
    const [newItemAsgDate, setNewItemAsgDate] = React.useState(modAsgDate);
    let [newItemTags, applyNewItemTags] = usePatchableState([]);
    if(itemTags != undefined) {
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
        if(e.key == 'Enter') addItem();
    }

    return (
        <div className="ItemCont">
            <div className="Item">
                <input type="text" value={newItemText} placeholder="new item..."
                    style={{flexGrow: '1'}}
                    onKeyDown={onKeyDown}
                    onChange={(e) => setNewItemText(e.target.value)}/>
                {!small && (modAsgDate!==undefined) && <input type="date" value={newItemAsgDate} required onChange={(e) => setNewItemAsgDate(e.target.value)}/>}
                {!small && <input type="date" value={newItemDueDate} onChange={(e) => setNewItemDueDate(e.target.value)}/>}
                {!small && <TagEdit tags={newItemTags} apply={applyNewItemTags} placeholder="tags..."/>}
                <button onClick={addItem}>+</button>
            </div>
       </div>
    );
     
}

function DayTodoList({data, apply, currentDate, smallItems}) {
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

            <NewItemEdit data={data} apply={apply} itemProps={{assigned_day: dateToStr(currentDate)}} small={smallItems}/>
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
            {items.length>0 && <hr/>}
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

function SearchView({data, apply}) {
    const [query, setQuery] = React.useState('');
    const [queryTags, applyQueryTags] = usePatchableState([]);

    const itemsSearcher = React.useMemo(() => new Fuse(data.items, { keys: [ 'text', 'tags' ] }), [data.items]);
    const items = React.useMemo(() => {
        let fzres = itemsSearcher.search(query);
        if(fzres.length == 0) {
            fzres = data.items.map((v,i) => ({ item: v, refIndex: i }));
        }
        if(queryTags.length > 0) {
            return fzres.filter(i =>
                i.item.tags.reduce((a, v) => a||(queryTags.indexOf(v)!=-1), false));
        } else {
            return fzres;
        }
    }, [query, queryTags, itemsSearcher, data.items]);

    return (
        <div className="App" style={{width: '70%', justifySelf: 'center'}}>
            <div style={{display: 'flex', alignItems: 'center'}}>
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
                        itemTags={[queryTags, applyQueryTags]} small={false}/>
            </div>
        </div>
    );
}

function TodoApp({userId, logout}) {
    const [data, apply, unsync_size, ver] = useTeledata({items: []});

    const tagContextValue = React.useMemo(() => ({ tags: data.tags, applyTags: cdapply(apply, '/tags') }), [data.tags, apply]);

    return (
        <Router>
            <div className="Page">
                <div className="Header">
                    <div>
                        <span>{APP_NAME}</span>
                        <NavLink to="/day" activeClassName="current">by day</NavLink>
                        <NavLink to="/week" activeClassName="current">by week</NavLink>
                        <NavLink to="/search" activeClassName="current">by filter</NavLink>
                    </div>
                    <div style={{marginRight: '1em'}}>
                        <span style={{marginRight: '0.5em', fontWeight: 'normal'}}>{userId}</span>
                        <button onClick={logout}>Logout</button>
                    </div>
                </div>

                <TagContext.Provider value={tagContextValue}>
                    <Switch>
                        <Route path="/day">
                            <SingleDayView data={data} apply={apply}/>
                        </Route>
                        <Route path="/week">
                            <WeekView data={data} apply={apply}/>
                        </Route>
                        <Route path="/search">
                            <SearchView data={data} apply={apply}/>
                        </Route>
                        <Route exact path="/">
                            <Redirect to="/day"/>
                        </Route>
                    </Switch>
                </TagContext.Provider>

                <p className="Footer" style={{fontSize: 'small', fontStyle: 'italic', textAlign: 'center', color: '#aaa'}}>
                    Unsynchronized patches: {unsync_size} &mdash; Data version: {ver}
                </p>
            </div>
        </Router>
    );
}

function Login({login}) {
    const [uid, setUid] = React.useState('');
    const [pswd, setPswd] = React.useState('');

    return (
        <div className="Page">
            <div className="Header" style={{borderBottom: '1px solid'}}>
                <span>{APP_NAME}</span>
                <div style={{marginRight: '1em'}}>
                    <input type="text" placeholder="username" value={uid} onChange={(e) => setUid(e.target.value)}/>
                    <input type="password" placeholder="password" value={pswd} onChange={(e) => setPswd(e.target.value)}/>
                    <button onClick={() => login(uid, pswd)}>Login</button>
                    <button onClick={() => createNewUser(uid, pswd,
                        login,
                        (d) => alert(d ? 'username already registered' : 'failed to create user account, try again'))}>Create new user</button>
                </div>
            </div>
            <div className="App">
                <span style={{fontSize: 'xx-large'}}><b>{APP_NAME}</b> is a todo tracker based around the idea of creating a new todo list everyday; merging todos, calendars and agendas.</span>
            </div>
        </div>
    );
}


function App() {
    const [userId, login, logout] = useAccount(
        () => {},
        (t) => { alert('login failed: ' + (t ? 'username or password incorrect' : 'unknown')); },
        () => { window.location = '/'; }
    );

    return userId === null ? <Login login={login}/> : <TodoApp userId={userId} logout={logout}/>;
}

export default App;
