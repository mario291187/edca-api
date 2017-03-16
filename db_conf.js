
var options = {};

pgp = require('pg-promise')(options);

var edca_db;

// Linked postgresql docker container
if ( typeof process.env.POSTGRES_PORT_5432_TCP_ADDR != "undefined" ) {
    process.env.EDCA_DB = 'postgres://';
    process.env.EDCA_DB += process.env.POSTGRES_USER || 'postgres';
    process.env.EDCA_DB += ':';
    process.env.EDCA_DB += process.env.POSTGRES_ENV_POSTGRES_PASSWORD || '';
    process.env.EDCA_DB += '@';
    process.env.EDCA_DB += process.env.POSTGRES_PORT_5432_TCP_ADDR;
    process.env.EDCA_DB += '/';
    process.env.EDCA_DB += process.env.POSTGRES_DB || 'postgres';
}

if ( typeof process.env.EDCA_DB != "undefined" ){
    console.log("EDCA_DB: ", process.env.EDCA_DB);
    edca_db = pgp( process.env.EDCA_DB );
} else {
    console.log("Warning: EDCA_DB env variable is not set\n " +
        " defaulting to -> postgres://tester:test@localhost/edca");
    edca_db = pgp({
        host: 'localhost',
        //port: 5433,
        database: 'edca',
        user: 'tester',
        password: 'test'
    });
}


module.exports = {
    edca_db : edca_db
};
