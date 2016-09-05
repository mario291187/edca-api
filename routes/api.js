var express = require('express');
var router = express.Router();


var pgp = require ('pg-promise')();


/* GET users listing. */
router.get('/', function(req, res, next) {
    res.send('Contrataciones Abiertas - API');
});

var edca_db;

if ( typeof process.env.EDCA_DB != "undefined" ){
    console.log("EDCA_DB: ", process.env.EDCA_DB);
    edca_db = pgp( process.env.EDCA_DB );
} else {
    console.log("Warning: EDCA_DB env variable is not set\n " +
        " defaulting to -> postgres://tester:test@localhost/edca");
    edca_db = pgp("postgres://tester:test@localhost/edca");
}


/* * * * * * * *
 * Information *
 * * * * * * * */

router.post('/list/contractingprocess', function(req, res){

    edca_db.manyOrNone("select id, ocid, stage from contractingprocess ").then(function(data){
        res.json(data)
    }).catch(function (error) {

    });

});


/* * * * * * * * * * * * * * * *
 * Creates a new contracting   *
 * process and returns the id  *
 * * * * * * * * * * * * * * * */
router.post('/new/contractingprocess', function(req, res){
    res.json ({
        status : 'ok',
        cpid : -1,
        msg: req.body.a
    });
});

/* * * * * * * * * * * * * * * * * *
 * Updates:                        *
 * entities created with the       *
 * /new/contractingprocess request *
 * * * * * * * * * * * * * * * * * */

router.post('/update/stage', function (req, res){

    var cpid = +req.body.cpid;
    var stage = +req.body.stage;

    if ( isNaN(cpid) || isNaN(stage) || stage < 0 || stage > 4){
        res.json({
            status: "ERROR",
            description: "Error de validación",
            data : {}
        })
    }

    edca_db.one('update contractingprocess set stage = $1 where id = $2 returning id',[
        cpid,
        stage
    ]).then(function (data) {
        res.json({
            status: 'Ok',
            description: "Proceso de contratación actualizado",
            data: data
        });
    }).catch(function(error){
        console.log(error);
        res.json({
            status: 'ERROR',
            msg: 'Ha ocurrido un error',
            data: error
        });
    });
});

//Planning
router.post('/update/planning', function (req, res){


    edca_db.one ('update planning set $... where contractingprocess_id = $...',[

    ]).then(function (data) {
        res.json({
            status: "Ok",
            description: "Los datos han sido actualizados",
            data: data
        });
    }).catch(function (error) {
        res.json({
            status:  "Error",
            description: "Ha ocurrido un error",
            data: error
        });
    });

});

// buyer
router.post('/update/buyer', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Tender
router.post('/update/tender', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Award
router.post('/update/award', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Contract
router.post('/update/contract', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Implementation
router.post('/update/implementation', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Publisher
router.post('/update/publisher', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

/* * * * * * * *
 * Insertions  *
 * * * * * * * */

// Items
router.post('/new/item', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Amendment changes
router.post('/new/amendmentchange', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Organizations -> tenderers, suppliers, ...
router.post('/new/organization', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Transactions
router.post('/new/transaction', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Documents
router.post('/new/document', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

/* * * * * *
 * Delete  *
 * * * * * */
router.post('/delete/contractingprocess',function (req, res ) {

    var cpid = +req.body.cpid;

    if (isNaN(cpid) ){
        res.json({
            status: "Error",
            description: "Error de validación",
            data: {}
        });
    }

    edca_db.one('delete from contractingprocess cascade where id = $1 returning id',[ cpid ]).then(function (data) {
        res.json({
            status: "Ok",
            description: "Proceso eliminado",
            data: data
        });
    }).catch( function(data){
        res.json({
            status : 'Error',
            description: "Ha ocurrido un error",
            data: data
        })
    });


});


module.exports = router;
