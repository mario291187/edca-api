var express = require('express');
var app = express();
var router = express.Router();
var pgp = require ('pg-promise')();

var bCrypt = require('bcrypt-nodejs');

/* index */
router.get('/', function(req, res, next) {
    res.json({
        message: "Bienvenido al API de la plataforma de contrataciones abiertas EDCA-MX."
    });
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




/* * *
 * Authenticate
 * */

var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var config = require("../config");
var User = require('../models/user');

mongoose.connect(config.database);
app.set('superSecret', config.secret);

var isValidPassword = function(user, password){
    return bCrypt.compareSync(password, user.password);
};

router.post('/authenticate', function( req, res ){

    // find the user
    User.findOne({
        username: req.body.username
    }, function(err, user) {

        if (err) throw err;

        if (!user) {
            res.json({ success: false, message: 'Fallo de autentificación: No se encontró el usuario.' });
        } else if (user) {

            // check if password matches
            if (isValidPassword(user, req.body.password)) {
                // if user is found and password is right
                // create a token
                var token = jwt.sign(user, app.get('superSecret'), {
                    expiresIn : 60*60*24// expires in 24 hours
                });

                // return the information including token as JSON
                res.json({
                    success: true,
                    message: 'Token generado exitosamente.',
                    token: token
                });
            } else {
                res.json({ success: false, message: 'Fallo de autentificación: Contraseña erronea.' });
            }
        }
    });


});

function verifyToken(req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['x-access-token'];

    // decode token
    if (token) {

        // verifies secret and checks exp
        jwt.verify(token, app.get('superSecret'), function (err, decoded) {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message: 'Failed to authenticate token.'
                });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });

    } else {

        // if there is no token
        // return an error
        return res.status(403).json({
            success: false,
            message: 'No token provided.'
        });

    }
}



/* * * * * * * * * * * *
 * Getting information *
 * * * * * * * * * * * */


function getTableName( path, opType ) {
    var table = "";
    switch( path ){
        case "contractingprocess":
            table = "contractingprocess";
            break;
        //Documents
        case "planning-document":
            table = "planningdocuments";
            break;
        case "tender-document":
            table = "tenderdocuments";
            break;
        case "award-document":
            table = "awarddocuments";
            break;
        case "contract-document":
            table = "contractdocuments";
            break;
        case "implementation-document":
            table = "implementationdocuments";
            break;
        /*case "tender-milestone-document":
            table = "tendermilestonedocuments";
            break;
        case "implementation-milestone-document":
            table = "implementationmilestonedocuments";
            break;*/
        //Amendment changes
        case "tender-amendment-change":
            table = "tenderamendmentchanges";
            break;
        case "award-amendment-change":
            table = "awardamendmentchanges";
            break;
        case "contract-amendment-change":
            table = "contractamendmentchanges";
            break;
        //Items
        case "tender-item":
            table = "tenderitem";
            break;
        case "award-item":
            table = "awarditem";
            break;
        case "contract-item":
            table = "contractitem";
            break;
        //Milestones
        case "tender-milestone":
            table = "tendermilestone";
            break;
        case "implementation-milestone":
            table = "implementationmilestone";
            break;
        //Transactions
        case "transaction":
            table = "implementationtransaction";
            break;
        //Tenderers
        case "tenderer":
            table = "tenderer";
            break;
        //Suppliers
        case "supplier":
            table = "supplier";
            break;
    }


    if ( opType == "read" ){
        switch ( path ) {
            case "planning":
                break;
            case "budget":
                break;
            case "tender":
                break;
            case "award":
                break;
            case "contract":
                break;
        }
    }

    return table;
}

var ocds = require('../ocds');
router.get('/get/ocds/releasepackage/:id',function (req,res) {
    var id = Math.abs(req.params.id);

    if (!isNaN(id)) {

        ocds.getOCDSJSON(id, 'release-package', edca_db).then(function (data) {
            delete data.localid;
            res.json ({
                status : "Ok",
                description: "Relese package",
                data : data
            });

        }).catch(function (error) {
            res.json ({
                status : "Error",
                description: "Ha ocurrido un error",
                data : error
            });
        });
    }else{
        res.json({
            status: "Error",
            description: "Ha ocurrido un error.",
            data: {
                message: "Parámetros incorrectos."
            }
        });
    }
});

router.get('/get/:path/:limit/:offset', verifyToken, function(req, res){

    var table = getTableName( req.params.path, 'read' );
    var limit = Math.abs(req.params.limit);
    var offset = Math.abs(req.params.offset);

    if ( table != "" && !isNaN(limit) && !isNaN(offset)) {
        edca_db.manyOrNone("select * from $1~ order by id limit $2 offset $3", [
            table,
            limit,
            offset
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Objetos: " + table,
                data: data
            })
        }).catch(function (error) {

            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            })
        });
    }else {
        res.status(400).json ({
            status: "Error",
            description : "Ha ocurrido un error",
            data : {
                message : "Objeto no válido"
            }
        })
    }

});

router.get('/getbyid/:path/:id', verifyToken ,function(req, res){

    var table = getTableName( req.params.path, 'read' );
    var id = Math.abs( req.params.id );

    if ( table != "" && !isNaN( id )){

        edca_db.oneOrNone("select * from $1~ where id = $2", [
            table,
            id
        ]).then(function (data) {

            res.json({
                status: "Ok",
                description:"Detalle",
                data : data
            })
        }).catch(function(error){
            res.json({
                status: "Error",
                description:"Ha ocurrido un error",
                data: error
            })
        });
    }else {
        res.status(400).json({
            status : "Error",
            description: "Ha ocurrido un error",
            data : "Parámetros incorrectos."
        });

    }
});


/* * * * * *
 * Updates *
 * * * * * */
//Contracting process
router.post("/update/contractingprocess/:id", verifyToken, function (req, res){

    // contractingprocess_id -> id (consecutivo) del proceso de contratación con el cual se registró en el sistema EDCA
    // stage -> etapa en que se encuentra la contratación: 0 -> planning, 1 -> licitación, 2 -> adjudicación, 3 -> contratación, 4 -> implementación
    // Open Contracting ID (ocid)->  Es un ID global asignado al proceso de contratación, puede ser cualquier cosa

    var stage = Math.abs(req.params.stage);
    var id = Math.abs(req.params.id);

    if ( !isNaN( id ) && !isNaN( stage ) && stage <= 4){

        edca_db.one("update contractingprocess set ocid = $1, stage = $2, uri=$3, license=$4, publicationpolicy=$5 where id = $6 returning id, ocid, stage", [
            req.body.ocid,
            stage,
            req.body.uri,
            req.body.license,
            req.body.publicationpolicy,
            id // id del proceso de contratación
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Proceso de contratación actualizado",
                data: data
            });
        }).catch(function(error){
            res.json({
                status: "Error",
                description: 'Ha ocurrido un error',
                data: error
            });
        });
    }else{
        res.status(400).json({
            status: "Error",
            description: "Ha ocurrido un error.",
            data : {
                message: "Parámetros incorrectos."
            }
        })
    }
});

//Planning
router.post('/update/planning/:id',verifyToken, function (req, res){

    var id = Math.abs( req.params.id );

    if (!isNaN( id )) {
        edca_db.tx(function (t) {

            return this.batch([
                //planning
                t.one("update planning set rationale = $1 where id = $2 returning id, contractingprocess_id", [
                    req.body.rationale,
                    id //id de la planeación
                ])
            ]).then(function (data) {

                var planning = {
                    id: data.id,
                    contractingprocess_id: data.contractingprocess_id
                };

                //budget
                return t.batch([
                    planning,
                    t.one("update budget set budget_source = $2, budget_budgetid =$3, budget_description= $4, budget_amount=$5, budget_currency=$6, budget_project=$7, budget_projectid=$8, budget_uri=$9" +
                        " where ContractingProcess_id=$1 returning id", [
                        data.contractingprocess_id, // id del proceso de contratación
                        req.body.budget_source,
                        req.body.budget_budgetid,
                        req.body.budget_description,
                        ( isNaN(req.body.budget_amount) ? null : req.body.budget_amount),
                        req.body.budget_currency,
                        req.body.budget_project,
                        req.body.budget_projectid,
                        req.body.budget_uri
                    ])
                ]);
            });

        }).then(function (data) {
            res.json({
                status: "Ok",
                description: "Los datos han sido actualizados",
                data: data
            });
        }).catch(function (error) {
            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    } else{
        res.status(400).json({
            status : "Error",
            description: "Ha ocurrido un error",
            data : {
                message : "Parámetros incorrectos."
            }
        })
    }
});

// organizations -> buyer, tenderers, suppliers
router.post('/update/organization/:type/:id',verifyToken, function (req, res){

    var id = Math.abs( req.params.id );
    if ( (req.params.type == "buyer" || req.params.type == "tenderer" || req.params.type == "supplier") && !isNaN(id) ) {

        edca_db.one("update $1~ set identifier_scheme= $3, identifier_id =$4, identifier_legalname=$5, identifier_uri=$6, name = $7, address_streetaddress=$8," +
            " address_locality=$9, address_region =$10, address_postalcode=$11, address_countryname=$12, contactpoint_name=$13, contactpoint_email=$14, contactpoint_telephone=$15," +
            " contactpoint_faxnumber=$16, contactpoint_url=$17 where id = $2 returning id", [
            req.params.type, //  tabla donde se inserta el registro, opciones -> buyer, tendererer, supplier
            id, // id de la organización
            req.body.identifier_scheme,
            req.body.identifier_id,
            req.body.identifier_legalname,
            req.body.identifier_uri,
            req.body.name,
            req.body.address_streetaddress,
            req.body.address_locality,
            req.body.address_region,
            req.body.address_postalcode,
            req.body.address_countryname,
            req.body.contactpoint_name,
            req.body.contactpoint_email,
            req.body.contactpoint_telephone,
            req.body.contactpoint_faxnumber,
            req.body.contactpoint_url
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Organización actualizada",
                data: data
            });
        }).catch(function (error) {
            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    }else {
        res.status(400).json ({
            status : "Error",
            description: "Ha ocurrido un error",
            data: {}
        });
    }
});

// Tender
router.post('/update/tender/:id',verifyToken, function (req, res){
    var id = Math.abs(req.params.id);

    if (!isNaN(id)) {
        edca_db.one("update tender set tenderid =$2, title= $3, description=$4, status=$5, minvalue_amount=$6, minvalue_currency=$7, value_amount=$8, value_currency=$9, procurementmethod=$10," +
            "procurementmethod_rationale=$11, awardcriteria=$12, awardcriteria_details=$13, submissionmethod=$14, submissionmethod_details=$15," +
            "tenderperiod_startdate=$16, tenderperiod_enddate=$17, enquiryperiod_startdate=$18, enquiryperiod_enddate=$19 ,hasenquiries=$20, eligibilitycriteria=$21, awardperiod_startdate=$22," +
            "awardperiod_enddate=$23, numberoftenderers=$24, amendment_date=$25, amendment_rationale=$26" +
            " where id = $1 returning id", [
            id, //id de licitación asignado por el sistema
            req.body.tenderid, // id de licitación, puede ser cualquier cosa
            req.body.title,
            req.body.description,
            req.body.status,
            (isNaN(req.body.minvalue_amount) ? null : req.body.minvalue_amount),
            req.body.minvalue_currency,
            (isNaN(req.body.value_amount) ? null : req.body.value_amount),
            req.body.value_currency,
            req.body.procurementmethod,
            req.body.procurementmethod_rationale,
            req.body.awardcriteria,
            req.body.awardcriteria_details,
            req.body.submissionmethod,
            req.body.submissionmethod_details,
            (req.body.tenderperiod_startdate instanceof Date) ? req.body.tenderperiod_startdate : null,
            (req.body.tenderperiod_enddate instanceof Date) ? req.body.tenderperiod_enddate : null,
            (req.body.enquiryperiod_startdate instanceof Date) ? req.body.enquiryperiod_startdate : null,
            (req.body.enquiryperiod_enddate instanceof Date) ? req.body.enquiryperiod_enddate : null,
            req.body.hasenquiries,
            req.body.eligibilitycriteria,
            (req.body.awardperiod_startdate instanceof Date) ? req.body.awardperiod_startdate : null,
            (req.body.awardperiod_enddate instanceof Date) ? req.body.awardperiod_enddate : null,
            req.body.numberoftenderers,
            (req.body.amendment_date instanceof Date ) ? req.body.amendment_date : null,
            req.body.amendment_rationale
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Etapa de licitación actualizada",
                data: data
            });
        }).catch(function (error) {
            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            });

        });
    }else {
        res.status(400).json({
            status : "Error",
            description: "Ha ocurrido un error",
            data: {
                message: "Parámetros incorrectos."
            }
        });
    }
});

// Award
router.post('/update/award/:id',verifyToken, function (req, res){
    var id = Math.abs( req.params.id );

    if (!isNaN(id )) {
        edca_db.one("update award set awardid=$2, title= $3, description=$4,status=$5,award_date=$6,value_amount=$7,value_currency=$8,contractperiod_startdate=$9," +
            "contractperiod_enddate=$10,amendment_date=$11,amendment_rationale=$12 " +
            " where id = $1 returning id", [
            id, // id de adjudicación asignado por el sistema
            req.body.awardid, // id de adjudicación, puede ser cualquier cosa
            req.body.title,
            req.body.description,
            req.body.status,
            (req.body.award_date instanceof Date) ? req.body.award_date : null,
            (isNaN(req.body.value_amount) ? null : req.body.value_amount),
            req.body.value_currency,
            (req.body.contractperiod_startdate instanceof Date ) ? req.body.contractperiod_startdate : null,
            (req.body.contractperiod_enddate instanceof Date ) ? req.body.contractperiod_enddate : null,
            (req.body.amendment_date instanceof Date ) ? req.body.amendment_date : null,
            req.body.amendment_rationale
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Etapa de ajudicación actualizada",
                data: data
            });

        }).catch(function (error) {
            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    }else {
        res.status(400).json({
            status : "Error",
            description : "Ha ocurrido  un error",
            data : "Parámetros incorrectos "
        });
    }
});

// Contract
router.post('/update/contract/:id',verifyToken, function (req, res){

    var id = Math.abs( req.params.id );

    if ( !isNaN(id) ) {
        edca_db.one("update contract set contractid=$2, awardid=$3, title=$4, description=$5, status=$6, period_startdate=$7, period_enddate=$8, value_amount=$9, value_currency=$10," +
            " datesigned=$11, amendment_date=$12, amendment_rationale=$13 " +
            " where id = $1 returning id", [
            id, // id del proceso de contratación
            req.body.contractid, // id de la etapa de contrato, puede ser cualquier cosa
            req.body.awardid, // id de la etapa de adjudicación, puede ser cualquier cosa, pero debe hacer match con la etapa de adjudicación
            req.body.title,
            req.body.description,
            req.body.status,
            (req.body.period_startdate instanceof Date) ? req.body.period_startdate : null,
            (req.body.period_enddate instanceof Date) ? req.body.period_enddate : null,
            (isNaN(req.body.value_amount) ? null : req.body.value_amount),
            req.body.value_currency,
            (req.body.datesigned instanceof Date ) ? req.body.datesigned : null,
            (req.body.amendment_date instanceof Date ) ? req.body.amendment_date : null,
            req.body.amendment_rationale
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Etapa de contrato actualizada",
                data: data
            })
        }).catch(function (error) {
            res.json({
                status: "Ok",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    }else {
        res.status(400).json({
            status : 'Error',
            description : "Ha ocurrido un error",
            data : {
                message : "Parámetos incorrectos."
            }
        })
    }
});

// Publisher
router.post('/update/publisher/:id',verifyToken, function (req, res){
    var id = Math.abs( req.params.id );

    if ( !isNaN(id )) {
        edca_db.one("update publisher set name=$2, scheme=$3, uid=$4, uri=$5 where id = $1 returning ContractingProcess_id, id as publisher_id, name, scheme, uid, uri", [
            id, //id del publisher
            req.body.name,
            req.body.scheme,
            req.body.uid,
            req.body.uri
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Publisher actualizado",
                data: data
            });
        }).catch(function (error) {
            res.json({
                status: "Ok",
                description: "Ha ocurrido un error",
                data: error
            })
        });
    }else {
        res.status(400).json({
            status : "Error",
            description : "Ha ocurrido un error",
            data : {
                message : "Parámetros incorrectos"
            }
        });
    }
});

/* * * * * * * *
 * Insertions  *
 * * * * * * * */

// new contracting process
router.put('/new/contractingprocess',verifyToken, function(req, res){
    var ocid = req.body.ocid ;
    var stage = Math.abs(req.body.stage);


    if ( ocid !="" && !isNaN(stage) && stage <= 4) {

        edca_db.tx(function (t) {

            return t.one("insert into ContractingProcess (fecha_creacion, hora_creacion, ocid, stage, uri, license, publicationpolicy ) values " +
                "(current_date, current_time,  $1, $2, $3, $4, $5)" +
                " returning id", [
                ocid,
                stage,
                req.body.uri,
                req.body.license,
                req.body.publicationpolicy
            ]).then(function (process) {

                return t.batch([
                    process = {id: process.id},
                    t.one("insert into Planning (ContractingProcess_id) values ($1) returning id", [process.id]),
                    t.one("insert into Tender (ContractingProcess_id) values ($1) returning id as tender_id", [process.id]),
                    t.one("insert into Contract (ContractingProcess_id) values ($1) returning id", [process.id])
                ]);

            }).then(function (info) {

                var process = {process_id: info[0].id};
                var planning = {planning_id: info[1].id};

                return t.batch([
                    process, planning,
                    t.one("insert into Budget (ContractingProcess_id, Planning_id) values ($1, $2 ) returning id as budget_id", [info[0].id, info[1].id]),
                    t.one("insert into Buyer (ContractingProcess_id) values ($1) returning id as buyer_id", [info[0].id]),
                    t.one("insert into ProcuringEntity (contractingprocess_id, tender_id) values ($1, $2) returning id as procuringentity_id", [info[0].id, info[2].id]),
                    t.one("insert into Award (ContractingProcess_id) values ($1) returning id as award_id", [info[0].id]),
                    t.one("insert into Implementation (ContractingProcess_id, Contract_id ) values ($1, $2) returning id as implementation_id", [info[0].id, info[3].id]),
                    t.one("insert into Publisher (ContractingProcess_id) values ($1) returning id as publisher_id", info[0].id)
                ]);

            });
        }).then(function (data) {
            console.log(data);
            res.json({
                status: "Ok",
                description: "Se ha creado un nuevo registro de proceso de contratación",
                data: data
            });

        }).catch(function (error) {
            console.log(error);

            res.json({
                status: "Error",
                description: "Ha ocurrido un error al crear el nuevo proceso de contratación",
                data: error
            });
        });
    } else {
        res.status(400).json({
            status : "Error",
            description : "Ha ocurrido un error",
            data : {
                message : "Parámetros incorrectos."
            }
        });
    }
});

// Items
router.put('/new/:path/item/',verifyToken, function (req, res){

    // path -> tender, award, contract
    var table ="";
    switch ( req.params.path ){
        case "tender":
            table = "tenderitem";
            break;
        case "award":
            table = "awarditem";
            break;
        case "contract":
            table = "contractitem";
            break;
    }

    if ( table != "" ) {

        edca_db.one('insert into $1~ (contractingprocess_id, itemid, description, classification_scheme, classification_id, classification_description, classification_uri,' +
            ' quantity, unit_name, unit_value_amount, unit_value_currency) values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id', [
            table, // tabla donde se inserta el item, opciones -> tenderitems, awarditems, ...
            req.body.contractingprocess_id, // id del proceso de contratación
            req.body.itemid, //id del item, puede ser cualquier cosa
            req.body.description,
            req.body.classification_scheme,
            req.body.classification_id,
            req.body.classification_description,
            req.body.classification_uri,
            (isNaN(req.body.quantity) ? null : req.body.quantity),
            req.body.unit_name,
            (isNaN(req.body.unit_value_amount) ? null : req.body.unit_value_amount),
            req.body.unit_value_currency
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Se ha creado un nuevo artículo",
                data: data
            });

        }).catch(function (error) {
            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    }else {
        res.status(400).json({
            status : "Error",
            description : "Ha ocurrido un error",
            data :{
                message: "Parámetros incorrectos"
            }
        })
    }
});

// Amendment changes
router.put('/new/:path/amendmentchange/',verifyToken, function (req, res){
    // path -> tender, award, contract

    var table = "";
    switch ( req.params.path ) {
        case "tender":
            table = "tenderamendmentchanges";
            break;
        case "award":
            table = "awardamendmentchanges";
            break;
        case "contract":
            table = "contractamendmentchanges";
            break
    }

    if ( table != "") {
        edca_db.one('insert into $1~ (contractingprocess_id, property, former_value) values ($2,$3,$4) returning contractingprocess_id, id as amendmentchange_id', [
            table, //tabla donde se inserta el cambio
            req.body.contractingprocess_id, // id del proceso de contratación
            req.body.property,
            req.body.former_value
        ]).then(function (data) {
            res.send({
                stautus: "Ok",
                description: "El cambio ha sido registrado",
                data: data
            });
        }).catch(function (error) {
            res.send({
                stautus: "Error",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    } else {
        res.status(400).json({
            status: "Error",
            description: "Ha ocurrido un error",
            data: {
                message: "Parámetros incorrectos"
            }
        });
    }
});

router.put('/new/organization/:type',verifyToken, function (req, res){

    //type -> supplier,tenderer
    if (req.params.type == "supplier" || req.params.type == "tenderer"){

        edca_db.one("insert into $17~" +
            " (contractingprocess_id, identifier_scheme, identifier_id, identifier_legalname, identifier_uri, name, address_streetaddress," +
            " address_locality, address_region, address_postalcode, address_countryname, contactpoint_name, contactpoint_email, contactpoint_telephone," +
            " contactpoint_faxnumber, contactpoint_url) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id", [
            req.body.contractingprocess_id, // id del proceso de contratación
            req.body.identifier_scheme,
            req.body.identifier_id,
            req.body.identifier_legalname,
            req.body.identifier_uri,
            req.body.name,
            req.body.address_streetaddress,
            req.body.address_locality,
            req.body.address_region,
            req.body.address_postalcode,
            req.body.address_countryname,
            req.body.contactpoint_name,
            req.body.contactpoint_email,
            req.body.contactpoint_telephone,
            req.body.contactpoint_faxnumber,
            req.body.contactpoint_url,
            req.params.type // tabla donde se inserta la organización -> tenderer, supplier
        ]).then(function (data) {
            res.send({
                stautus : "Ok",
                description : "La organización ha sido registrada",
                data : data
            });
        }).catch(function (error) {
            res.send({
                stautus : "Error",
                description : "Ha ocurrido un error",
                data : error
            });
        });
    }else {
        res.status(400).json({
            stautus : "Error",
            description : "Ha ocurrido un error",
            data : {
                message: "Tipo de organización incorrecto, opciones: tenderer, supplier"
            }
        });
    }
});

//milestones -> hitos
router.put("/new/:path/milestone/",verifyToken, function (req, res) {
    //stage -> tender, implementation

    var table = "";
    switch( req.params.path ){
        case "tender":
            table = "tendermilestone";
            break;
        case "implementation":
            table = "implementationmilestone";
            break;
    }

    if ( table != "" ) {
        edca_db.one('insert into $1~ (contractingprocess_id, milestoneid, title, description, duedate, date_modified, status) values ($2,$3,$4,$5,$6,$7,$8) returning id', [
            table, // tabla donde se registra el hito
            req.body.contractingprocess_id, // id del proceso de contratación
            req.body.milestoneid, //id del hito, puede ser cualquier cosa
            req.body.title,
            req.body.description,
            (req.body.duedate instanceof Date) ? req.body.duedate : null,
            (req.body.date_modified instanceof Date) ? req.body.date_modified : null,
            req.body.status
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Hito registrado",
                data: data
            });
        }).catch(function (error) {
            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    }else {
        res.status(400).json({
            status: "Error",
            description :"Ha ocurrido un error",
            data :{
                message: "Parámetros incorrectos"
            }
        });
    }
});


// Documents
router.put('/new/:path/document/',verifyToken, function (req, res){
    //path -> planning, tender, award, contract, implementation, tender/milestone, implementation/milestone

    var table = "";

    switch( req.params.path ){
        case "planning":
            table = "planningdocuments";
            break;
        case "tender":
            table = "tenderdocuments";
            break;
        case "award":
            table = "awarddocuments";
            break;
        case "contract":
            table = "contractdocuments";
            break;
        case "implementation":
            table = "implementationdocuments";
            break;
        /*
        case "tender-milestone":
        table = "tendermilestonedocuments";
            break;
        case "implementation-milestone":
        table = "implementationmilestonedocuments";
            break;
            */
    }

    if ( table != "") {
        edca_db.one('insert into $1~ (contractingprocess_id, document_type, documentid, title, description, url, date_published, date_modified, format, language) values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id',
            [
                table, //tabla donde se inserta el documento, opciones: planningdocuments, tenderdocuments, awarddocuments, contractdocuments ...
                req.body.contractingprocess_id, // id del proceso de contratación
                req.body.document_type,
                req.body.documentid, //id del ducumento, puede ser cualquier cosa
                req.body.title,
                req.body.description,
                req.body.url,
                (req.body.date_published instanceof Date ) ? req.body.date_published : null,
                (req.body.date_modified instanceof Date ) ? req.body.date_modified : null,
                req.body.format,
                req.body.language // lenguaje del documento en código de dos letras
            ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Se ha registrado un nuevo documento",
                data: data
            });
        }).catch(function (error) {
            res.json({
                status: "Error",
                description: "Ha ocurrido un error",
                data: error
            });
        });
    }else{
        res.status(400).json({
            status: "Error",
            description: "Ha ocurrido un error",
            data: {
                message : "Parámetros incorrectos"
            }
        });
    }
});


// Implementation -> Transactions
router.put('/new/transaction/',verifyToken, function (req, res){

    edca_db.one('insert into implementationtransactions (contractingprocess_id, transactionid, source, implementation_date, value_amount, value_currency, ' +
        'providerorganization_scheme,providerorganization_id,providerorganization_legalname,providerorganization_uri,' +
        'receiverorganization_scheme,receiverorganization_id,receiverorganization_legalname,receiverorganization_uri, uri) ' +
        'values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id',[
        req.body.contractingprocess_id, // id del proceso de contratación
        req.body.transactionid,
        req.body.source,
        (req.body.implementation_date instanceof Date )?req.body.implementation_date:null,
        (isNaN(req.body.value_amount)?null:req.body.value_amount),
        req.body.value_currency,

        req.body.providerorganization_scheme,
        req.body.providerorganization_id,
        req.body.providerorganization_legalname,
        req.body.providerorganization_uri,

        req.body.receiverorganization_scheme,
        req.body.receiverorganization_id,
        req.body.receiverorganization_legalname,
        req.body.receiverorganization_uri,

        req.body.uri
    ]).then(function (data) {
        res.json({
            status :  "Ok",
            description: "Transacción registrada",
            data : data
        });
    }).catch(function (error) {
        res.json({
            status :  "Error",
            description:"Ha ocurrido un error",
            data : error
        });
    });
});


/* * * * * *
 * Delete  *
 * * * * * */
router.delete('/delete/:path/:id',verifyToken,function (req, res ) {

    var table = getTableName( req.params.path, 'delete' );
    var id = Math.abs(req.params.id);

    if (table != "" && !isNaN( id )) {
        edca_db.one('delete from $1~ cascade where id = $2 returning id', [
            table,
            id
        ]).then(function (data) {
            res.json({
                status: "Ok",
                description: "Objeto eliminado",
                data: data
            });
        }).catch(function (data) {
            res.json({
                status: 'Error',
                description: "Ha ocurrido un error",
                data: data
            })
        });
    }else {
        res.status(400).json({
            status : "Error",
            description: "Ha ocurrido un error",
            data : {
                message : "Proporcione correctamente la descripción del elemento que desea eliminar, e.g., 'contract-amendment-change'"
            }
        });
    }
});

module.exports = router;
