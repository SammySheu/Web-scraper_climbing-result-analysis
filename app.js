const express = require('express');
const app = express();

const bcrypt = require('bcrypt');
const passport = require('passport');
const initializePassport = require('./passport-config');

const flash = require('express-flash');
const session  = require('express-session');

const pool = require('./connectMySQL');

// const result = async () => {
//     const [data] = await pool.query('SELECT * FROM resultTable');
//     console.log(data);
// }
// result();

// let users = [
//     {
//         id: '1667991204716',
//         name: 'sam',
//         email: 'sam@home',
//         password: '$2b$10$1SjKh7ZIWoCyDf7.b3nWv.WSqBAHVzFGO2y6lc.nYJJPayW/bJocm'
//     }
// ];

initializePassport(
    passport, 
    email => {
        const currentUser = async () => {
            let sql = `SELECT * FROM resultTable where BINARY email='${email}'`
            const found = await pool.query(sql);
            // console.log(found[0][0]);
            return found[0][0];
        }
        // console.log(currentUser[0][0]);
        // return users.find(el => el.email === email)
        return currentUser();
    },
    id => {
        const currentUser = async () => {
            let sql = `SELECT * FROM resultTable where BINARY id='${id}'`
            const found = await pool.query(sql);
            // console.log(found[0][0]);
            return found[0][0];
        }
        return currentUser();
        // return users.find(el => el.id === id)
    }
)

const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use( express.urlencoded({extended:true}));
app.use( express.json() );
app.use( express.static(__dirname + '/public') );

if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}
// require('dotenv').config();

app.use( flash() );
app.use( session({
    secret: process.env.SESSION_SECRET, 
    resave: false, 
    saveUninitialized: false,
}))

app.use( passport.initialize() );
app.use( passport.session() );



app.get('/', async (req, res) => {
    let sql = `SELECT * FROM resultTable where BINARY name='Sam'`
    const currentUser = await pool.query(sql);
    console.log(currentUser[0][0]);
})

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

app.post('/login', passport.authenticate('local', {
    successRedirect: '/table', 
    failureRedirect: '/login', 
    failureFlash: true
}));

app.post('/register', checkNotAuthenticated, async (req, res) => {
    try{
        const id = Date.now().toString();
        const hashedPassword = await bcrypt.hash(req.body.registPassword, 10);
        //-------------------------Insert Data in MySQL-----------------
            let sql = `INSERT INTO resultTable (id, name, email, password) VALUES ("${id}", "${req.body.registUser}", "${req.body.registEmail}", "${hashedPassword}")`
            await pool.query(sql)
            // console.log(sql);
        //--------------------------------------------------------------
        // users.push({
        //     id, 
        //     name: req.body.registUser,
        //     email: req.body.registEmail,
        //     password: hashedPassword,
        // })
    res.redirect('/login');
    }catch(err){
        res.redirect('/register')
        console.log(err);
    }
    // console.log(users);
});

app.post('/logout', (req, res, next) => {
    req.logOut( (err) => {
        if (err) return next(err);
        res.redirect('/login');
    });
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