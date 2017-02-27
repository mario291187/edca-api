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

const uuid = require('uuid/v4');

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

    if ( opType == "delete"){
        switch ( path ){
            case "contractingprocess":
                table = "contractingprocess";
                break;
        }
    }

    return table;
}

var ocds = require('../ocds');
router.get('/get/ocds/releasepackage/:id',verifyToken,function (req,res) {
    var id = Math.abs(req.params.id);

    if (!isNaN(id)) {

        ocds.getOCDSJSON(id, 'release-package', edca_db).then(function (data) {
            delete data.localid;
            res.json ({
                status : "Ok",
                description: "Release package",
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

router.get('/getall/contractingprocess', verifyToken,  function (req, res) {
    edca_db.manyOrNone("select * from contractingprocess order by id").then(function (data) {
        res.json({
            status: "Ok",
            description : "Listado de procesos de contratación",
            data : data
        });
    }).then(function (error) {
        res.json({
            status : "Error",
            description: "Ha ocurrido un error",
            data : error
        })
    });
});

router.get('/getall/:path/:contractingprocess_id/', verifyToken, function(req, res){

    var table = getTableName( req.params.path, 'read' );
    var contractingprocess_id = Math.abs(req.params.contractingprocess_id);

    if ( table != "" && !isNaN(contractingprocess_id)) {
        edca_db.manyOrNone("select * from $1~ where contractingprocess_id = $2 order by id", [
            table,
            contractingprocess_id
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


function dateCol( date ) {
    return (date == '')?null:date;
}

function numericCol( number ){
    return (isNaN(number))?null:number;
}

/* * * * * *
 * Updates *
 * * * * * */
//Contracting process
router.post("/update/contractingprocess/:id", verifyToken, function (req, res){

    // contractingprocess_id -> id (consecutivo) del proceso de contratación con el cual se registró en el sistema EDCA
    // stage -> etapa en que se encuentra la contratación: 0 -> planning, 1 -> licitación, 2 -> adjudicación, 3 -> contratación, 4 -> implementación
    // Open Contracting ID (ocid)->  Es un ID global asignado al proceso de contratación, puede ser cualquier cosa

    var stage = Math.abs(req.body.stage);
    var id = Math.abs(req.params.id);

    if ( !isNaN( id ) && !isNaN( stage ) && stage <= 4){

        edca_db.one("update contractingprocess set ocid = $1, stage = $2, uri=$3, license=$4, publicationpolicy=$5, destino=$6 where id = $7 returning id, ocid, stage", [
            req.body.ocid,
            stage,
            req.body.uri,
            req.body.license,
            req.body.publicationpolicy,
            req.body.destino,
            //req.body.description
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
router.post('/update/planning/:contractingprocess_id',verifyToken, function (req, res){

    var id = Math.abs( req.params.contractingprocess_id );

    if (!isNaN( id )) {
        edca_db.tx(function (t) {

            return this.batch([
                //planning
                t.one("update planning set rationale = $1 where contractingprocess_id = $2 returning id, contractingprocess_id", [
                    req.body.rationale,
                    id //id del proceso
                ])
            ]).then(function (data) {
                //budget
                return t.batch([
                    //planning,
                    t.one("update budget set budget_source = $2, budget_budgetid =$3, budget_description= $4, budget_amount=$5, budget_currency=$6, budget_project=$7, budget_projectid=$8, budget_uri=$9" +
                        " where ContractingProcess_id=$1 returning id as planning_id, contractingprocess_id", [
                        data[0].contractingprocess_id, // id del proceso de contratación
                        req.body.budget_source,
                        req.body.budget_budgetid,
                        req.body.budget_description,
                        numericCol( req.body.budget_amount ),
                        req.body.budget_currency,
                        req.body.budget_project,
                        req.body.budget_projectid,
                        req.body.budget_uri
                    ])
                ]);
            });

        }).then(function (data) {
            res.status(200).json({
                status: "Ok",
                description: "Los datos han sido actualizados",
                data: data
            });
        }).catch(function (error) {
            res.status(400).json({
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


router.post('/update/buyer/:contractingprocess_id',verifyToken, function (req, res) {
    var id = Math.abs( req.params.contractingprocess_id );
    if ( !isNaN(id) ) {

        edca_db.one("update buyer set identifier_scheme= $2, identifier_id =$3, identifier_legalname=$4, identifier_uri=$5, name = $6, address_streetaddress=$7," +
            " address_locality=$8, address_region =$9, address_postalcode=$10, address_countryname=$11, contactpoint_name=$12, contactpoint_email=$13, contactpoint_telephone=$14," +
            " contactpoint_faxnumber=$15, contactpoint_url=$16 where contractingprocess_id = $1 returning id, contractingprocess_id", [
            id, // id del proceso
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
            data: {
                message : "Parámetros incorrectos"
            }
        });
    }
});

router.post('/update/procuringentity/:contractingprocess_id',verifyToken, function (req, res) {
    var id = Math.abs( req.params.contractingprocess_id );
    if ( !isNaN(id) ) {

        edca_db.one("update procuringentity set identifier_scheme= $2, identifier_id =$3, identifier_legalname=$4, identifier_uri=$5, name = $6, address_streetaddress=$7," +
            " address_locality=$8, address_region =$9, address_postalcode=$10, address_countryname=$11, contactpoint_name=$12, contactpoint_email=$13, contactpoint_telephone=$14," +
            " contactpoint_faxnumber=$15, contactpoint_url=$16 where contractingprocess_id = $1 returning id, contractingprocess_id", [
            id, // id del proceso
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
            data: {
                message : "Parámetros incorrectos"
            }
        });
    }
});

// organizations -> tenderers, suppliers
router.post('/update/organization/:type/:id',verifyToken, function (req, res){

    var id = Math.abs( req.params.id );
    if ( ( req.params.type == "tenderer" || req.params.type == "supplier") && !isNaN(id) ) {

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
            data: {
                message : "Parámetros incorrectos"
            }
        });
    }
});

// Tender
router.post('/update/tender/:contractingprocess_id',verifyToken, function (req, res){
    var id = Math.abs(req.params.contractingprocess_id);

    if (!isNaN(id)) {
        edca_db.one("update tender set tenderid =$2, title= $3, description=$4, status=$5, minvalue_amount=$6, minvalue_currency=$7, value_amount=$8, value_currency=$9, procurementmethod=$10," +
            "procurementmethod_rationale=$11, awardcriteria=$12, awardcriteria_details=$13, submissionmethod=$14, submissionmethod_details=$15," +
            "tenderperiod_startdate=$16, tenderperiod_enddate=$17, enquiryperiod_startdate=$18, enquiryperiod_enddate=$19 ,hasenquiries=$20, eligibilitycriteria=$21, awardperiod_startdate=$22," +
            "awardperiod_enddate=$23, numberoftenderers=$24, amendment_date=$25, amendment_rationale=$26" +
            " where contractingprocess_id = $1 returning id", [
            id, //id de proceso asignado por el sistema
            req.body.tenderid, // id de licitación, puede ser cualquier cosa
            req.body.title,
            req.body.description,
            req.body.status,
            numericCol(req.body.minvalue_amount),
            req.body.minvalue_currency,
            numericCol(req.body.value_amount),
            req.body.value_currency,
            req.body.procurementmethod,
            req.body.procurementmethod_rationale,
            req.body.awardcriteria,
            req.body.awardcriteria_details,
            req.body.submissionmethod,
            req.body.submissionmethod_details,
            dateCol(req.body.tenderperiod_startdate),
            dateCol(req.body.tenderperiod_enddate),
            dateCol(req.body.enquiryperiod_startdate),
            dateCol(req.body.enquiryperiod_enddate),
            req.body.hasenquiries,
            req.body.eligibilitycriteria,
            dateCol(req.body.awardperiod_startdate),
            dateCol(req.body.awardperiod_enddate),
            numericCol(req.body.numberoftenderers),
            dateCol(req.body.amendment_date),
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
router.post('/update/award/:contractingprocess_id',verifyToken, function (req, res){
    var id = Math.abs( req.params.contractingprocess_id );

    if (!isNaN(id )) {
        edca_db.one("update award set awardid=$2, title= $3, description=$4,status=$5,award_date=$6,value_amount=$7,value_currency=$8,contractperiod_startdate=$9," +
            "contractperiod_enddate=$10, amendment_date=$11, amendment_rationale=$12 " +
            " where contractingprocess_id = $1 returning id", [
            id, // id de adjudicación asignado por el sistema
            req.body.awardid, // id de adjudicación, puede ser cualquier cosa
            req.body.title,
            req.body.description,
            req.body.status,
            dateCol(req.body.award_date),
            numericCol(req.body.value_amount),
            req.body.value_currency,
            dateCol(req.body.contractperiod_startdate ),
            dateCol(req.body.contractperiod_enddate ),
            dateCol(req.body.amendment_date),
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
router.post('/update/contract/:contractingprocess_id',verifyToken, function (req, res){

    var id = Math.abs( req.params.contractingprocess_id );

    if ( !isNaN(id) ) {
        edca_db.one("update contract set contractid=$2, awardid=$3, title=$4, description=$5, status=$6, period_startdate=$7, period_enddate=$8, value_amount=$9, value_currency=$10," +
            " datesigned=$11, amendment_date=$12, amendment_rationale=$13 " +
            " where contractingprocess_id = $1 returning id", [
            id, // id del proceso de contratación
            req.body.contractid, // id de la etapa de contrato, puede ser cualquier cosa
            req.body.awardid, // id de la etapa de adjudicación, puede ser cualquier cosa, pero debe hacer match con la etapa de adjudicación
            req.body.title,
            req.body.description,
            req.body.status,
            dateCol(req.body.period_startdate),
            dateCol(req.body.period_enddate),
            numericCol(req.body.value_amount),
            req.body.value_currency,
            dateCol(req.body.datesigned ),
            dateCol(req.body.amendment_date),
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
router.post('/update/publisher/:contractingprocess_id',verifyToken, function (req, res){
    var id = Math.abs( req.params.contractingprocess_id );

    if ( !isNaN(id )) {
        edca_db.one("update publisher set name=$2, scheme=$3, uid=$4, uri=$5 where contractingprocess_id = $1 returning ContractingProcess_id, id as publisher_id, name, scheme, uid, uri", [
            id, //id del proceso
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

            return t.one("insert into ContractingProcess (fecha_creacion, hora_creacion, ocid, stage, uri, license, publicationpolicy, destino ) values " +
                "(current_date, current_time,  $1, $2, $3, $4, $5, $6)" +
                " returning id", [
                ocid,
                stage,
                req.body.uri,
                req.body.license,
                req.body.publicationpolicy,
                req.body.destino
                //req.body.description
            ]).then(function (process) {

                return t.batch([
                    process = { id : process.id },
                    t.one("insert into Planning (ContractingProcess_id) values ($1) returning id as planning_id", process.id),
                    t.one("insert into Tender (ContractingProcess_id) values ($1) returning id as tender_id", [process.id]),
                    t.one("insert into Award (ContractingProcess_id) values ($1) returning id as award_id", [process.id]),
                    t.one("insert into Contract (ContractingProcess_id) values ($1) returning id as contract_id", [process.id]),
                    t.one("insert into Buyer (ContractingProcess_id) values ($1) returning id as buyer_id",[process.id]),
                    t.one("insert into Publisher (ContractingProcess_id) values ($1) returning id as publisher_id", process.id)
                ]);

            }).then(function (info) {
                return t.batch([
                    //process, planning, tender, award, contract, buyer, publisher,
                    { contractingprocess : { id: info[0].id } },
                    { planning : { id: info[1].planning_id } },
                    { tender : { id: info[2].tender_id } },
                    { award: { id:info[3].award_id } },
                    { contract: { id:info[4].contract_id } },
                    { buyer : { id: info[5].buyer_id } },
                    { publisher: { id: info[6].publisher_id } },
                    t.one("insert into Budget (ContractingProcess_id, Planning_id) values ($1, $2 ) returning id as budget_id", [info[0].id, info[1].planning_id]),
                    t.one("insert into ProcuringEntity (contractingprocess_id, tender_id) values ($1, $2) returning id as procuringentity_id",[info[0].id, info[2].tender_id]),
                    t.one("insert into Implementation (ContractingProcess_id, Contract_id ) values ($1, $2) returning id as implementation_id", [info[0].id, info[4].contract_id])
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
router.put('/new/:path/item/:contractingprocess_id',verifyToken, function (req, res){

    var contractingprocess_id = Math.abs(req.params.contractingprocess_id);
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

    if ( table != "" && !isNaN(contractingprocess_id) ) {

        edca_db.one('insert into $1~ (contractingprocess_id, itemid, description, classification_scheme, classification_id, classification_description, classification_uri,' +
            ' quantity, unit_name, unit_value_amount, unit_value_currency) values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id', [
            table, // tabla donde se inserta el item, opciones -> tenderitems, awarditems, ...
            contractingprocess_id, // id del proceso de contratación
            "item-"+uuid()/*(new Date().getTime())*/,//req.body.itemid, //id del item, puede ser cualquier cosa
            req.body.description,
            req.body.classification_scheme,
            req.body.classification_id,
            req.body.classification_description,
            req.body.classification_uri,
            numericCol(req.body.quantity),
            req.body.unit_name,
            numericCol(req.body.unit_value_amount),
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

router.put('/new/:path/many-items/:contractingprocess_id',verifyToken, function (req, res){

    var contractingprocess_id = Math.abs(req.params.contractingprocess_id);
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

    if ( table != "" && !isNaN(contractingprocess_id) && req.body.items.length > 0 ) {

        edca_db.tx(function (t) {

            var item_queries = [];

            for (var i =0; i < req.body.items.length ; i++){
                item_queries.push(
                    this.one('insert into $1~ (contractingprocess_id, itemid, description, classification_scheme, classification_id, classification_description, classification_uri,' +
                        ' quantity, unit_name, unit_value_amount, unit_value_currency) values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id', [
                        table, // tabla donde se inserta el item, opciones -> tenderitems, awarditems, ...
                        contractingprocess_id, // id del proceso de contratación
                        "item-"+uuid()/*(new Date().getTime())*/,//req.body.itemid, //id del item, puede ser cualquier cosa
                        req.body.items[i].description,
                        req.body.items[i].classification_scheme,
                        req.body.items[i].classification_id,
                        req.body.items[i].classification_description,
                        req.body.items[i].classification_uri,
                        numericCol(req.body.items[i].quantity),
                        req.body.items[i].unit_name,
                        numericCol(req.body.items[i].unit_value_amount),
                        req.body.items[i].unit_value_currency
                    ])
                );
            }
            return this.batch( item_queries );
        }).then(function(items){
            res.json({
                status: "Ok",
                description: "Se ha registrado un bloque de artículos",
                data: items
            });

        }).catch(function (error) {
            console.log(error);
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
router.put('/new/:path/amendmentchange/:contractingprocess_id',verifyToken, function (req, res){
    // path -> tender, award, contract

    var contractingprocess_id = Math.abs( req.params.contractingprocess_id);
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

    if ( table != "" && !isNaN(contractingprocess_id)) {
        edca_db.one('insert into $1~ (contractingprocess_id, property, former_value) values ($2,$3,$4) returning contractingprocess_id, id as amendmentchange_id', [
            table, //tabla donde se inserta el cambio
            contractingprocess_id, // id del proceso de contratación
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

router.put('/new/organization/:type/:contractingprocess_id',verifyToken, function (req, res){

    //type -> supplier,tenderer
    var contractingprocess_id = Math.abs(req.params.contractingprocess_id);

    if ((req.params.type == "supplier" || req.params.type == "tenderer") && !isNaN(contractingprocess_id)){

        edca_db.one("insert into $17~" +
            " (contractingprocess_id, identifier_scheme, identifier_id, identifier_legalname, identifier_uri, name, address_streetaddress," +
            " address_locality, address_region, address_postalcode, address_countryname, contactpoint_name, contactpoint_email, contactpoint_telephone," +
            " contactpoint_faxnumber, contactpoint_url) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id", [
            contractingprocess_id, // id del proceso de contratación
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
router.put("/new/:path/milestone/:contractingprocess_id",verifyToken, function (req, res) {
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

    var contractingprocess_id = Math.abs( req.params.contractingprocess_id);
    if ( table != "" && !isNaN(contractingprocess_id) ) {
        edca_db.one('insert into $1~ (contractingprocess_id, milestoneid, title, description, duedate, date_modified, status) values ($2,$3,$4,$5,$6,$7,$8) returning id', [
            table, // tabla donde se registra el hito
            contractingprocess_id, // id del proceso de contratación
            "milestone-"+uuid()/*(new Date().getTime())*/,//req.body.milestoneid, //id del hito, puede ser cualquier cosa
            req.body.title,
            req.body.description,
            dateCol(req.body.duedate),
            dateCol(req.body.date_modified),
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

//milestones -> hitos
router.put("/new/:path/many-milestones/:contractingprocess_id",verifyToken, function (req, res) {
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

    var contractingprocess_id = Math.abs( req.params.contractingprocess_id);

    if ( table != "" && !isNaN(contractingprocess_id) && req.body.milestones.length > 0 ) {

        edca_db.tx(function (t) {
            var milestone_queries = [];

            for (var i = 0 ; i< req.body.milestones.length; i++){
                milestone_queries.push( this.one('insert into $1~ (contractingprocess_id, milestoneid, title, description, duedate, date_modified, status) values ($2,$3,$4,$5,$6,$7,$8) ' +
                    'returning id as milestone_id, contractingprocess_id', [
                        table, // tabla donde se registra el hito
                        contractingprocess_id, // id del proceso de contratación
                        "milestone-"+uuid()/*(new Date().getTime())*/,//req.body.milestoneid, //id del hito, puede ser cualquier cosa
                        req.body.milestones[i].title,
                        req.body.milestones[i].description,
                        dateCol(req.body.milestones[i].duedate),
                        dateCol(req.body.milestones[i].date_modified),
                        req.body.milestones[i].status
                    ])
                );
            }

            return this.batch( milestone_queries );

        }).then(function (milestones) {
            res.json({
                status: "Ok",
                description: "Se ha registrado un bloque de hitos",
                data: milestones
            });
        }).catch(function (error) {
            console.log(error);
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
router.put('/new/:path/document/:contractingprocess_id',verifyToken, function (req, res){
    //path -> planning, tender, award, contract, implementation, tender/milestone, implementation/milestone

    var table = "";
    var contractingprocess_id = Math.abs(req.params.contractingprocess_id);

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

    if ( table != "" && !isNaN(contractingprocess_id) ){
        edca_db.one('insert into $1~ (contractingprocess_id, document_type, documentid, title, description, url, date_published, date_modified, format, language) values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ' +
            'returning id as document_id, contractingprocess_id',
            [
                table, //tabla donde se inserta el documento, opciones: planningdocuments, tenderdocuments, awarddocuments, contractdocuments ...
                contractingprocess_id, // id del proceso de contratación
                req.body.document_type,
                "doc-"+uuid()/*(new Date().getTime())*/,//req.body.documentid, //id del ducumento, puede ser cualquier cosa
                req.body.title,
                req.body.description,
                req.body.url,
                dateCol(req.body.date_published ),
                dateCol(req.body.date_modified),
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

// Documents
router.put('/new/:path/many-documents/:contractingprocess_id',verifyToken, function (req, res){
    //path -> planning, tender, award, contract, implementation, tender/milestone, implementation/milestone

    var table = "";
    var contractingprocess_id = Math.abs(req.params.contractingprocess_id);

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

    //console.log(req.body.documents.length);

    if ( table != "" && !isNaN(contractingprocess_id) && req.body.documents.length > 0 ){

        edca_db.tx(function (t) {

            var document_queries=[];
            for ( var i=0; i < req.body.documents.length; i++ ){

                document_queries.push( this.one('insert into $1~ (contractingprocess_id, document_type, documentid, title, description, url, date_published, date_modified, format, language) ' +
                    'values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ' +
                    'returning id as document_id, contractingprocess_id',
                    [
                        table, //tabla donde se inserta el documento, opciones: planningdocuments, tenderdocuments, awarddocuments, contractdocuments ...
                        contractingprocess_id, // id del proceso de contratación
                        req.body.documents[i].document_type,
                        "doc-"+uuid()/*(new Date().getTime())*/,//req.body.documentid, //id del ducumento, puede ser cualquier cosa
                        req.body.documents[i].title,
                        req.body.documents[i].description,
                        req.body.documents[i].url,
                        dateCol(req.body.documents[i].date_published ),
                        dateCol(req.body.documents[i].date_modified),
                        req.body.documents[i].format,
                        req.body.documents[i].language // lenguaje del documento en código de dos letras
                    ])
                );
            }

            return this.batch( document_queries );

        }).then(function (documents) {
            res.json({
                status: "Ok",
                description: "Se ha registrado un bloque de documentos",
                data: documents
            });

        }).catch(function(error){
            console.log(error);
            res.status(400).json({
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
router.put('/new/transaction/:contractingprocess_id',verifyToken, function (req, res){

    var contractingprocess_id = Math.abs(req.params.contractingprocess_id);
    if ( !isNaN(contractingprocess_id)) {

        edca_db.one('insert into implementationtransactions (contractingprocess_id, transactionid, source, implementation_date, value_amount, value_currency, ' +
            'providerorganization_scheme,providerorganization_id,providerorganization_legalname,providerorganization_uri,' +
            'receiverorganization_scheme,receiverorganization_id,receiverorganization_legalname,receiverorganization_uri, uri) ' +
            'values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id', [
            contractingprocess_id, // id del proceso de contratación
            "transaction-" + uuid()/* (new Date().getTime())*/,//req.body.transactionid,
            req.body.source,
            dateCol(req.body.implementation_date ),
            numericCol(req.body.value_amount),
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
                status: "Ok",
                description: "Transacción registrada",
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
        res.json({
            status: "Error",
            description: "Ha ocurrido un error",
            data : {
                message : "Parámetros incorrectos"
            }
        })
    }
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

router.delete('/delete/all/:path/:contractingprocess_id',verifyToken,function (req, res ) {

   var table = getTableName( req.params.path, 'delete' );
   var id = Math.abs(req.params.contractingprocess_id);

   if (table != "" && !isNaN( id )) {
       edca_db.manyOrNone('delete from $1~ cascade where contractingprocess_id = $2 returning id', [
           table,
           id
       ]).then(function (data) {
           res.json({
               status: "Ok",
               description: "Objetos eliminado",
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
