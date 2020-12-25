import React from 'react';
import './App.css';
import { useTeledata, useAccount, createNewUser, cdapply } from './Transport.js';
import { BrowserRouter as Router, Switch, Route, NavLink, Redirect } from 'react-router-dom';

import { APP_NAME, TagContext } from './Common';
import { SingleDayView, WeekView, SearchView } from './Views.js';

/*
 + suggestions
 + week view
 + search
 + tags
 + backend db
 * subitems
 + user accounts
 + logged out view
 + fix SPA server side
 * add some demo gifs
 * optimize
 + unassigned items
 * heroku hosting
 */

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
