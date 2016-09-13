var express = require('express');
var router = express.Router();


var pgp = require ('pg-promise')();


/* index */
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


/* * * * * * * * * * * *
 * Getting information *
 * * * * * * * * * * * */

router.post('/list/entities', function(req, res){

    edca_db.manyOrNone("select * from $1~ ", [ req.body.entity ]).then(function(data){
        res.json({
            status: "Ok",
            Description: "Listado: " + req.body.entity,
            data: data
        })
    }).catch(function (error) {

        res.json({
            status: "Error",
            description : "Ha ocurrido un error",
            data : error
        })
    });

});


/* * * * * *
 * Updates *
 * * * * * */

router.post('/update/contractingprocess', function (req, res){

    var contractingprocess_id = +req.body.localid;
    var stage = +req.body.stage;
    var ocid = req.body.ocid;

    //column set


    if ( isNaN( contractingprocess_id ) || isNaN(stage) || stage < 0 || stage > 4){

        edca_db.oneOrNone(" update contractingprocess set stage = $1 where localid = $2 returning id ", [ stage, contractingprocess_id ]).then(function (data) {
            res.send({
                status:"Ok",
                description: "Proceso de contratación: Etapa actualizada",
                data: data
            })

        }).catch(function (error) {
            console.log(error);

            res.json({
                status : "Error",
                description : "Ha ocurrido un error",
                data : error
            });
        });
    }

    edca_db.one('update contractingprocess set ocid = $1, stage = $2 where id = $3 returning id', [
            ocid,
            stage,
            contractingprocess_id
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

    edca_db.tx(function (t) {

        return this.bath([
            //planning
            this.one("update planning set rationale = $1 where ContractingProcess_id = $2 returning id", [
                req.body.rationale,
                req.body.contractingprocess_id //id del proceso de contratación
            ]),

            //budget
            this.one("update budget set budget_source = $2, budget_budgetid =$3, budget_description= $4, budget_amount=$5, budget_currency=$6, budget_project=$7, budget_projectid=$8, budget_uri=$9" +
                " where ContractingProcess_id=$1 returning id", [
                req.body.contractingprocess_id, // id del proceso de contratación
                req.body.budget_source,
                req.body.budget_budgetid,
                req.body.budget_description,
                ( isNaN(req.body.budget_amount) ?null:req.body.budget_amount),
                req.body.budget_currency,
                req.body.budget_project,
                req.body.budget_projectid,
                req.body.budget_uri
            ])
        ]);

    }).then(function (data) {
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

// organizations -> buyer, tenderers, suppliers
router.post('/update/organization/', function (req, res){


    edca_db.one("update $1~ set identifier_scheme= $3, identifier_id =$4, identifier_legalname=$5, identifier_uri=$6, name = $7, address_streetaddress=$8," +
        " address_locality=$9, address_region =$10, address_postalcode=$11, address_countryname=$12, contactpoint_name=$13, contactpoint_email=$14, contactpoint_telephone=$15," +
        " contactpoint_faxnumber=$16, contactpoint_url=$17 where ContractingProcess_id = $2 returning id", [
            req.body.table, //  tabla donde se inserta el registro -> buyer, tendererer, supplier
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
            req.body.contactpoint_url
        ]).then( function (data) {
        res.json({
            status: 'Ok',
            description : "Comprador actualizado",
            data : data
        });
    }).catch(function(error){
        res.json({
            status: "Error",
            description: "Ha ocurrido un error",
            data : error
        });
    });
});

// Tender
router.post('/update/tender', function (req, res){

    edca_db.one("update tender set tenderid =$2, title= $3, description=$4, status=$5, minvalue_amount=$6, minvalue_currency=$7, value_amount=$8, value_currency=$9, procurementmethod=$10," +
        "procurementmethod_rationale=$11, awardcriteria=$12, awardcriteria_details=$13, submissionmethod=$14, submissionmethod_details=$15," +
        "tenderperiod_startdate=$16, tenderperiod_enddate=$17, enquiryperiod_startdate=$18, enquiryperiod_enddate=$19 ,hasenquiries=$20, eligibilitycriteria=$21, awardperiod_startdate=$22," +
        "awardperiod_enddate=$23, numberoftenderers=$24, amendment_date=$25, amendment_rationale=$26" +
        " where ContractingProcess_id = $1 returning id", [
        req.body.contractingprocess_id, //id del proceso de contratación
        req.body.tenderid,
        req.body.title,
        req.body.description,
        req.body.status,
        (isNaN(req.body.minvalue_amount)?null:req.body.minvalue_amount),
        req.body.minvalue_currency,
        (isNaN(req.body.value_amount)?null:req.body.value_amount),
        req.body.value_currency,
        req.body.procurementmethod,
        req.body.procurementmethod_rationale,
        req.body.awardcriteria,
        req.body.awardcriteria_details,
        req.body.submissionmethod,
        req.body.submissionmethod_details,
        (req.body.tenderperiod_startdate!='')?req.body.tenderperiod_startdate:null,
        (req.body.tenderperiod_enddate!='')?req.body.tenderperiod_enddate:null,
        (req.body.enquiryperiod_startdate!='')?req.body.enquiryperiod_startdate:null,
        (req.body.enquiryperiod_enddate!='')?req.body.enquiryperiod_enddate:null,
        req.body.hasenquiries,
        req.body.eligibilitycriteria,
        (req.body.awardperiod_startdate!='')?req.body.awardperiod_startdate:null,
        (req.body.awardperiod_enddate!='')?req.body.awardperiod_enddate:null,
        req.body.numberoftenderers,
        (req.body.amendment_date!='')?req.body.amendment_date:null,
        req.body.amendment_rationale
    ]).then(function (data) {
        res.json({
            status : "Ok",
            description : "Etapa de licitación actualizada",
            data : data
        });
    }).catch(function (error){
        res.json({
            status: "Error",
            description : "Ha ocurrido un error",
            data : error
        });

    });
});

// Award
router.post('/update/award', function (req, res){
    edca_db.one("update award set awardid=$2, title= $3, description=$4,status=$5,award_date=$6,value_amount=$7,value_currency=$8,contractperiod_startdate=$9," +
        "contractperiod_enddate=$10,amendment_date=$11,amendment_rationale=$12 " +
        " where ContractingProcess_id = $1 returning id",
        [
            req.body.contractingprocess_id, // id del proceso de contratación
            req.body.awardid,
            req.body.title,
            req.body.description,
            req.body.status,
            (req.body.award_date!='')?req.body.award_date:null,
            (isNaN(req.body.value_amount)?null:req.body.value_amount),
            req.body.value_currency,
            (req.body.contractperiod_startdate!='')?req.body.contractperiod_startdate:null,
            (req.body.contractperiod_enddate!='')?req.body.contractperiod_enddate:null,
            (req.body.amendment_date!='')?req.body.amendment_date:null,
            req.body.amendment_rationale
        ]
    ).then(function(data){
        res.json ({
           status: "Ok",
            description: "Etapa de ajudicación actualizada",
            data: data
        });

    }).catch(function(error){
        res.json({
            status : "Error",
            description : "Ha ocurrido un error",
            data : error
        });
    });
});

// Contract
router.post('/update/contract', function (req, res){
    edca_db.one("update contract set contractid=$2, awardid=$3, title=$4, description=$5, status=$6, period_startdate=$7, period_enddate=$8, value_amount=$9, value_currency=$10," +
        " datesigned=$11, amendment_date=$12, amendment_rationale=$13 " +
        " where ContractingProcess_id = $1 returning id", [
        req.body.contractingprocess_id, // id del proceso de contratación
        req.body.contractid, // id de la etapa de contrato, puede ser cualquier cosa
        req.body.awardid, // id de la etapa de adjudicación, puede ser cualquier cosa, pero debe hacer match con la etapa de adjudicación
        req.body.title,
        req.body.description,
        req.body.status,
        (req.body.period_startdate!='')?req.body.period_startdate:null,
        (req.body.period_enddate!='')?req.body.period_enddate:null,
        (isNaN(req.body.value_amount)?null:req.body.value_amount),
        req.body.value_currency,
        (req.body.datesigned!='')?req.body.datesigned:null,
        (req.body.amendment_date!='')?req.body.amendment_date:null,
        req.body.amendment_rationale
    ]).then(function (data) {
        res.json({
            status : "Ok",
            description : "Etapa de contrato actualizada",
            data : error
        })
    }).catch(function (error) {
        res.json ({
            status : "Ok",
            description : "Ha ocurrido un error",
            data : error
        });
    });
});

// Publisher
router.post('/update/publisher', function (req, res){
    edca_db.one("update publisher set name=$2, scheme=$3, uid=$4, uri=$5 where id = $1 returning id", [
            req.body.contractingprocess_id, //id del proceso de contratación
            req.body.name,
            req.body.scheme,
            req.body.uid,
            req.body.uri
        ]).then(function (data) {
        res.json({
            status:  "Ok",
            description : "Publisher actualizado",
            data : data
        });
    }).catch(function (error) {
        res.json({
            status : "Ok",
            description : "Ha ocurrido un error",
            data : error
        })
    });
});

/* * * * * * * *
 * Insertions  *
 * * * * * * * */

// new contracting process
router.post('/new/contractingprocess', function(req, res){

    edca_db.tx(function (t) {

        return t.one("insert into ContractingProcess (fecha_creacion, hora_creacion, ocid, stage ) values " +
            "(current_date, current_time, concat('NUEVA_CONTRATACION_', current_date,'_', current_time), 0) returning id").then(function (process) {

            return t.batch([
                process = { id : process.id},
                t.one("insert into Planning (ContractingProcess_id) values ($1) returning id", [process.id]),
                t.one ("insert into Tender (ContractingProcess_id,status) values ($1, $2) returning id as tender_id", [process.id, 'none']),
                t.one ("insert into Contract (ContractingProcess_id, status) values ($1, $2) returning id", [process.id, 'none'])
            ]);

        }).then(function (info) {

            var process= {process_id : info[0].id};
            var planning = {planning_id : info[1].id};

            return t.batch([
                process, planning,
                t.one("insert into Budget (ContractingProcess_id, Planning_id) values ($1, $2 ) returning id as budget_id", [info[0].id, info[1].id]),
                t.one("insert into Buyer (ContractingProcess_id) values ($1) returning id as buyer_id",[info[0].id]),
                t.one("insert into ProcuringEntity (contractingprocess_id, tender_id) values ($1, $2) returning id as procuringentity_id",[info[0].id, info[2].id]),
                t.one("insert into Award (ContractingProcess_id,status) values ($1, $2) returning id as award_id", [info[0].id, 'none']),
                t.one("insert into Implementation (ContractingProcess_id, Contract_id ) values ($1, $2) returning id as implementation_id", [info[0].id, info[3].id]),
                t.one("insert into Publisher (ContractingProcess_id) values ($1) returning id as publisher_id", info[0].id)
            ]);

        });
    }).then(function (data) {
        console.log(data);
        res.json ({
            status : 'ok',
            description : "Se ha creado un nuevo registro de proceso de contratación",
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
});

// Items
router.post('/new/item', function (req, res){

    edca_db.one('insert into $1~ (contractingprocess_id, itemid, description, classification_scheme, classification_id, classification_description, classification_uri,' +
        ' quantity, unit_name, unit_value_amount, unit_value_currency) values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id', [
            req.body.table, // tabla donde se inserta -> awarditems, ...
            req.body.contractingprocess_id, // id del proceso de contratación
            req.body.itemid,
            req.body.description,
            req.body.classification_scheme,
            req.body.classification_id,
            req.body.classification_description,
            req.body.classification_uri,
            (isNaN(req.body.quantity)?null:req.body.quantity),
            req.body.unit_name,
            (isNaN(req.body.unit_value_amount)?null:req.body.unit_value_amount),
            req.body.unit_value_currency
        ]).then(function (data) {
        res.json({
            status:  "Ok",
            description : "Se ha creado un nuevo artículo",
            data : data
        });

    }).catch(function (error) {
        res.json({
            status:  "Ok",
            description : "Ha ocurrido un error",
            data : error
        });
    });

});

// Amendment changes
router.post('/new/amendmentchange', function (req, res){

    edca_db.one('insert into $1~ (contractingprocess_id, property, former_value) values ($2,$3,$4) returning id',[
        req.body.table, //tabla donde se inserta el cambio
        req.body.contractingprocess_id, // id del proceso de contratación
        req.body.property,
        req.body.former_value
    ]).then(function (data) {
        res.send({
            stautus : "Ok",
            description : "El cambio ha sido registrado",
            data : data
        });
    }).catch(function (error) {
        res.send({
            stautus : "Error",
            description : "Ha ocurrido un error",
            data : error
        });
    });

});

// Organizations -> tenderers, suppliers
router.post('/new/organization', function (req, res){
    edca_db.one("insert into $17~" +
        " (contractingprocess_id, identifier_scheme, identifier_id, identifier_legalname, identifier_uri, name, address_streetaddress," +
        " address_locality, address_region, address_postalcode, address_countryname, contactpoint_name, contactpoint_email, contactpoint_telephone," +
        " contactpoint_faxnumber, contactpoint_url) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id",
        [
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
            req.body.table // tabla donde se inserta la organización -> tenderer, supplier
        ]
    ).then(function (data) {
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
});

// Transactions
router.post('/new/transaction', function (req, res){

    edca_db.one('insert into implementationtransactions (contractingprocess_id, transactionid, source, implementation_date, value_amount, value_currency, ' +
        'providerorganization_scheme,providerorganization_id,providerorganization_legalname,providerorganization_uri,' +
        'receiverorganization_scheme,receiverorganization_id,receiverorganization_legalname,receiverorganization_uri, uri) ' +
        'values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id',[
        req.body.contractingprocess_id, // id del proceso de contratación
        req.body.transactionid,
        req.body.source,
        (req.body.implementation_date != '')?req.body.implementation_date:null,
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

// Documents
router.post('/new/document', function (req, res){
    edca_db.one('insert into $1~ (contractingprocess_id, document_type, documentid, title, description, url, date_published, date_modified, format, language) values ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id',
        [
            req.body.table, //tabla donde se inserta el documento
            req.body.contractingprocess_id, // id del proceso de contratación
            req.body.document_type,
            req.body.documentid, //id del ducumento, puede ser cualquier cosa
            req.body.title,
            req.body.description,
            req.body.url,
            (req.body.date_published!='')?req.body.date_published:null,
            (req.body.date_modified!='')?req.body.date_modified:null,
            req.body.format,
            req.body.language // lenguaje del documento en código de dos letras
        ]).then(function (data) {
        res.json({
            status:"Ok",
            description: "Se ha registrado un nuevo documento",
            data: data
        });
    }).catch(function(error){
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
router.post('/delete/contractingprocess',function (req, res ) {

    var cpid = +req.body. contractingprocess_id; //id del proceso de contratación que se requiere eliminar

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
