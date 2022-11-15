const express = require('express');
const app = express();

const bcrypt = require('bcrypt');
const passport = require('passport');
// const initializePassport = require('./passport-config');


const flash = require('express-flash');
const session  = require('express-session');
const mysql = require('mysql2');
// let mysql = require('mysql2');
// const mysql = require('promise-mysql');

if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}


app.set('trust proxy', 1);
let pool = mysql.createPool( {
    // host: 'localhost',
    host: '34.105.86.101',
    port: '3306',
    user: 'root',
    password: `${process.env.MySQL_PASSWORD}`,
    database: `${process.env.MySQL_DATABASE}`
} ).promise();
// con.connect();

// pool.on('connect', async function (err) {
//     console.log('Connected to redis successfully');
// });

const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use( express.urlencoded({extended:true}));
app.use( express.json() );
app.use( express.static(__dirname + '/public') );



app.use( flash() );

// ---------------------Set up Redis---------------------------------



const redis = require('redis');
const connectRedis = require('connect-redis');
let RedisStore = connectRedis(session)
const redisClient = redis.createClient({
    url: `${process.env.REDIS_URL}`,
    // host: 'localhost',
    // port: 6379,
    // ttl: 260,
    legacyMode: true
})
redisClient.connect()
    .catch(console.error);

redisClient.on('error', async function (err) {
    console.log('Could not establish a connection with redis. ' + err);
});
redisClient.on('connect', async function (err) {
    console.log('Connected to redis successfully');
});

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // if true only transmit cookie over https
        httpOnly: false, // if true prevent client side JS from reading the cookie 
        maxAge: 1000 * 60 * 3 // session max age in milliseconds
    }
}))

function getUserByEmail(email){
    const currentUser = async () => {
        let sql = `SELECT * FROM userInformationTable where BINARY email='${email}'`
        const found = await pool.query(sql);
        // console.log(found);
        return found[0][0];
    }
    return currentUser();
}

function getUserById(id){
    const currentUser = async () => {
        let sql = `SELECT * FROM userInformationTable where BINARY id='${id}'`
        const found = await pool.query(sql);
        // console.log(found[0][0]);
        return found[0][0];
    }
    return currentUser();
}
// --------------------------------
const LocalStrategy = require('passport-local').Strategy;

const authenticateUser = async (email, password, done) => {
    const userFromMySQL = await getUserByEmail(email);
    if(userFromMySQL == null){
        return done(null, false, {message: 'No user with that name'});
    }
    try{
        if( await bcrypt.compare(password, userFromMySQL.password) ){
            return done(null, userFromMySQL);
        }
        else {
            return done(null, false, {message: 'Password incorrect'});
        }
    } catch(error){
        return done(error);
    }
}

passport.use(
    new LocalStrategy( 
        { usernameField: 'email'}, authenticateUser
    )
);

// to store inside session
passport.serializeUser( (user, done) => {
    return done(null, user.id);
})
passport.deserializeUser( async (id, done) => {
    return done(null, await getUserById(id));
})



// app.use( session({
//     secret: process.env.SESSION_SECRET, 
//     resave: false, 
//     saveUninitialized: false,
// }))




// -----------------------------------------------------------------
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use( express.urlencoded({extended:true}));
app.use( express.json() );
app.use( express.static(__dirname + '/public') );


app.use( flash() );

app.use( passport.initialize() );
app.use( passport.session() );





app.get('/', (req, res) => {
    console.log(req.session);    
});

// app.get('/login', (req, res) => {
app.get('/login', checkNotAuthenticated, (req, res) => {
    res.render('login');
});

app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render('register');
})

app.get('/table', checkAuthenticated, async (req, res) => {
    try{
        let dataset = await fs.readFile('./data.txt', { encoding: 'utf8' });
        dataset = JSON.parse(dataset);
        // console.log(req.user.user);
        res.render('tableView', {dataset, name: req.user.name});
        // res.render('tableView');
    }
    catch(err) {
        console.log(err);
    }
});

app.post('/login',
    passport.authenticate('local', {
            successRedirect: '/table',
            failureRedirect: '/login', 
            failureFlash: true })
    // async (req, res) => {
    //     const { email, password} = req.body;
    //     const sess = req.session;
    //     sess.email = email;
    //     sess.password = password;
    //     console.log(sess.email, sess.password);
    //     // return res.end();
    //     // return res.redirect('/table');
    // }
    );

app.post('/testSession', (req, res) => {
    const sess = req.session;
    console.log(req.session.user, req.session.password);
    return res.send('success to store user information into session');
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
    try{
        const id = Date.now().toString();
        const hashedPassword = await bcrypt.hash(req.body.registPassword, 10);
        //-------------------------Insert Data in MySQL-----------------
        // let sql = `INSERT INTO userInformationTable (id, name, email, password) VALUES ("${id}", "${req.body.registUser}", "${req.body.registEmail}", "hello")`    
        let sql = `INSERT INTO userInformationTable (id, name, email, password) VALUES ("${id}", "${req.body.registUser}", "${req.body.registEmail}", "${hashedPassword}")`
            pool.query(sql)
            // console.log(answer);
            // console.log(sql);

        // })
    res.redirect('/login');
    }catch(err){
        res.redirect('/register')
        console.log(err);
    }
    // console.log(users);
});

app.post('/logout', (req, res, next) => {
    req.session.destroy(err => {
        if (err) return console.log(err);
    });
    req.logOut( (err) => {
        if (err) return next(err);
    });
    return res.redirect('/login');
})

app.listen(3000, () => {
    console.log('App listen on port 3000');
})

async function getIFSCdataWithPuppeteer(){
    try{
        //Init Puppeteer
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto('https://www.ifsc-climbing.org/index.php/world-competition/last-result');
        const component = await page.$('iframe.jch-lazyloaded');
        await delay(3000);

        //Extract data from frame document
        let frame = await component.contentFrame();
        
        const years = await frame.$('#years');
        await years.select('2022');
        await delay(3000);

        const indexes = await frame.$('#indexes');
        await indexes.select('/api/v1/season_leagues/404');
        await delay(3000);

        const events = await frame.$('#events');
        await events.select('/api/v1/events/1233');
        await delay(3000);

        const categories = await frame.$('#categories');
        await categories.select('/api/v1/events/1233/result/7');
        await delay(3000);
        

        // After select dropdown menu, save data into ./data.txt
        const data = await frame.evaluate( () => {
            const tableNode = document.querySelector('#table_id > tbody');
            let dataJson = [];
            for(let i=0 ; i<tableNode.children.length ; i++){
                const rank = tableNode.children[i].children[0].children[0].textContent;
                const name = tableNode.children[i].children[1].children[0].textContent;
                dataJson.push({rank, name});
            }
            return dataJson;
        }) ;
        
        await fs.writeFile('./data.txt', JSON.stringify(data, null, 2) , 'utf-8');
        console.log(data);
        
    } catch(error){
        console.log(error);
    }
}
// getIFSCdataWithPuppeteer();

function delay(timeout) {
    return new Promise((resolve) => {
      setTimeout(resolve, timeout);
    });
  }
  
function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect('/login');
}

function checkNotAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return res.redirect('/table');
    }
    next();
}