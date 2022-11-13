const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');


function initialize(passport, getUserByEmail, getUserById){
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
            ) );

    // to store inside session
    passport.serializeUser( (user, done) => {
        return done(null, user.id);
    })
    passport.deserializeUser( async (id, done) => {
        return done(null, await getUserById(id));
    })
}

module.exports = initialize;