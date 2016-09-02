var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
    res.send('Contrataciones Abiertas - API');
});

/* Creates a new contracting process and returns the id */
router.post('/new/contractingprocess', function(req, res){
    res.json ({
        status : 'ok',
        cpid : -1,
        msg: req.body.a
    });
});

/* Updates */

router.post('/update/stage', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});


//Planning
router.post('/update/planning', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
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
router.post('/update/planning', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Award
router.post('/update/planning', function (req, res){
    res.json({
        status: 'ok',
        msg: ";)"
    });
});

// Contract
router.post('/update/planning', function (req, res){
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

/* Insertions */

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

/* Delete */
router.post('/delete/contractingprocess',function (req, res ) {
     res.json({
         status : 'ok'
     });
});


module.exports = router;
