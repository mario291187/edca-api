module.exports = {

    getOCDSJSON: function ( localid , type, edca_db ) {

        //queries principales
        return edca_db.task(function (t) {

            return t.one("Select * from contractingprocess where id = $1", [localid]).then(function (cp) { //0

                var planning = t.one("select * from planning where contractingprocess_id = $1", [localid]);     //1
                var budget = t.one("select * from budget where contractingprocess_id = $1", [localid]);         //2
                var tender = t.one("select * from tender where contractingprocess_id = $1", [localid]);        //3
                var buyer = t.one("select * from buyer where contractingprocess_id = $1", [localid]);    //4
                var award = t.one("select * from award where contractingprocess_id = $1", [localid]);           //5
                var contract = t.one("select * from contract where contractingprocess_id = $1", [localid]);     //6
                var implementation = t.oneOrNone('select * from implementation where contractingprocess_id = $1', [localid]); //7
                var procuringentity = t.one('select * from ProcuringEntity where contractingprocess_id=$1', [localid]); //8

                return t.batch([cp, planning, budget, tender, buyer, award, contract, implementation, procuringentity]);

            }).then(function (data) {

                var qp = {
                    cp: data[0],
                    planning: data [1],
                    budget: data [2],
                    tender: data[3],
                    buyer: data [4],
                    award: data[5],
                    contract: data[6],
                    implementation: data[7],
                    procuringentity: data[8]
                };

                //queries secundarias
                return t.batch(
                    [
                        qp, //0
                        t.manyOrNone("select * from tenderer where contractingprocess_id=$1", [data[0].id]), //1
                        t.manyOrNone("select * from supplier where contractingprocess_id=$1", [data[0].id]), //2: dependen de awards
                        t.one("select * from publisher where contractingprocess_id=$1",[data[0].id]), //3
                        /* Documents */
                        t.manyOrNone('select * from planningdocuments where contractingprocess_id=$1',[data[0].id]),//4
                        t.manyOrNone('select * from tenderdocuments where contractingprocess_id=$1',[data[0].id]), //5
                        t.manyOrNone('select * from awarddocuments where contractingprocess_id=$1',[data[0].id]), //6
                        t.manyOrNone('select * from contractdocuments where contractingprocess_id=$1', [data[0].id]),//7
                        t.manyOrNone('select * from implementationdocuments where contractingprocess_id=$1 ',[data[0].id]), //8
                        /* Items */
                        t.manyOrNone('select * from tenderitem where contractingprocess_id=$1',[data[0].id]),// 9
                        t.manyOrNone('select * from awarditem where contractingprocess_id=$1',[data[0].id]), //10
                        t.manyOrNone('select * from contractitem where contractingprocess_id=$1',[data[0].id]),//11
                        /* Milestones */
                        t.manyOrNone('select * from tendermilestone where contractingprocess_id=$1',[data[0].id]), //12
                        t.manyOrNone('select * from implementationmilestone where contractingprocess_id=$1',[data[0].id]), //13
                        /* Transactions */
                        t.manyOrNone('select * from implementationtransactions where contractingprocess_id=$1', [data[0].id]), //14
                        /* Amendment changes */
                        t.manyOrNone('select * from tenderamendmentchanges where contractingprocess_id=$1',[data[0].id]), //15
                        t.manyOrNone('select * from awardamendmentchanges where contractingprocess_id=$1',[data[0].id]), //16
                        t.manyOrNone('select * from contractamendmentchanges where contractingprocess_id=$1',[data[0].id]) //17
                    ]);

            }).then(function (data) {

                function checkValue( x ) {
                    return ( x != null && x != '' && typeof x != "undefined");
                }

                function dateString( obj ) {
                    return obj instanceof Date ? obj.toISOString() : obj
                }

                function deleteNullProperties(test, recursive) {
                    for (var i in test) {
                        if (test[i] === null || JSON.stringify(test[i]) === JSON.stringify({}) || test[i]=='' ) {
                            delete test[i];
                        } else if (recursive && typeof test[i] === 'object') {
                            deleteNullProperties(test[i], recursive);
                            if (JSON.stringify(test[i]) === JSON.stringify({})){
                                delete test[i];
                            }
                        }
                    }
                }

                function getOrganizations(array){
                    var organizations = [];
                    for ( var i=0; i < array.length; i++){
                        var organization={};

                        organization.identifier = {};
                        if( checkValue(array[i].identifier_scheme)  ){organization.identifier.scheme = array[i].identifier_scheme;}
                        if( checkValue(array[i].identifier_id) ){organization.identifier.id = array[i].identifier_id;}
                        if( checkValue(array[i].identifier_legalname) ){organization.identifier.legalName = array[i].identifier_legalname;}
                        if( checkValue(array[i].identifier_uri) ){organization.identifier.uri = array[i].identifier_uri;}

                        //additionalIdentifiers:[ ],

                        if( checkValue(array[i].name) ){organization.name = array[i].name;}

                        organization.address = {};
                        if( checkValue(array[i].address_streetaddress) ){organization.address.streetAddress = array[i].address_streetaddress;}
                        if( checkValue(array[i].address_locality) ){organization.address.locality = array[i].address_locality;}
                        if( checkValue(array[i].address_region) ){organization.address.region = array[i].address_region;}
                        if( checkValue(array[i].address_postalcode) ){organization.address.postalCode = array[i].address_postalcode;}
                        if( checkValue(array[i].address_countryname) ){organization.address.countryName = array[i].address_countryname;}

                        organization.contactPoint = {};
                        if( checkValue(array[i].contactpoint_name) ){organization.contactPoint.name = array[i].contactpoint_name;}
                        if( checkValue(array[i].contactpoint_email) ){organization.contactPoint.email = array[i].contactpoint_email;}
                        if( checkValue(array[i].contactpoint_telephone) ){organization.contactPoint.telephone = array[i].contactpoint_telephone;}
                        if( checkValue(array[i].contactpoint_faxnumber) ){organization.contactPoint.faxNumber = array[i].contactpoint_faxnumber;}
                        if( checkValue(array[i].contactpoint_url) ){organization.contactPoint.url = array[i].contactpoint_url;}

                        deleteNullProperties(organization, true);

                        organizations.push(organization);

                    }
                    return organizations;
                }


                function getDocuments(array){
                    var documents =[];
                    for (var i=0; i < array.length; i++ ){
                        var document = { };

                        if(checkValue(array[i].documentid)){document.id = array[i].documentid;}
                        if(checkValue(array[i].document_type)){document.documentType = array[i].document_type;}
                        if(checkValue(array[i].title)){document.title = array[i].title;}
                        if(checkValue(array[i].description)){document.description = array[i].description;}
                        if(checkValue(array[i].url)){document.url = array[i].url;}
                        if(checkValue(array[i].date_published)){document.datePublished = dateString(array[i].date_published);}
                        if(checkValue(array[i].date_modified)){document.dateModified = dateString(array[i].date_modified);}
                        if(checkValue(array[i].format)){document.format = array[i].format;}
                        if(checkValue(array[i].language)){document.language = array[i].language;}

                        deleteNullProperties(document, true);

                        documents.push(document);
                    }
                    return documents;
                }

                function getItems(arr){
                    var items =[];
                    for (var i=0; i < arr.length;i++){
                        var item = { };
                        if(checkValue(arr[i].itemid)){item.id = arr[i].itemid;}
                        if(checkValue(arr[i].description)){item.description = arr[i].description;}
                        //additionalClasifications: [ ],

                        item.classification = { };
                        if(checkValue(arr[i].classification_scheme)){item.classification.scheme = arr[i].classification_scheme;}
                        if(checkValue(arr[i].classification_id)){item.classification.id = arr[i].classification_id;}
                        if(checkValue(arr[i].classification_description)){item.classification.description = arr[i]. classification_description;}
                        if(checkValue(arr[i].classification_uri)){item.classification.uri = arr[i].classification_uri;}

                        if(checkValue(arr[i].quantity)){item.quantity = arr[i].quantity;}

                        item.unit = { };
                        if(checkValue(arr[i].unit_name)){item.unit.name = arr[i].unit_name;}
                        item.unit.value = { };
                        if(checkValue(arr[i].unit_value_amount)){item.unit.value.amount = Number(arr[i].unit_value_amount);}
                        if(checkValue(arr[i].unit_value_currency)){item.unit.value.currency = arr[i].unit_value_currency;}

                        deleteNullProperties(item, true);

                        items.push(item);
                    }
                    return items;
                }

                function getMilestones(arr) {
                    var milestones =[];
                    for (var i=0; i < arr.length;i++){
                        var milestone = { };

                        if(checkValue(arr[i].milestoneid)){milestone.id = arr[i].milestoneid;}
                        if(checkValue(arr[i].title)){milestone.title = arr[i].title;}
                        if(checkValue(arr[i].description)){milestone.description = arr[i].description;}
                        if(checkValue(arr[i].duedate)){milestone.dueDate = dateString(arr[i].duedate);}
                        if(checkValue(arr[i].date_modified)){milestone.dateModified = dateString(arr[i].date_modified);}
                        if(checkValue(arr[i].status)){milestone.status = arr[i].status;}

                        deleteNullProperties(milestone, true);

                        milestones.push(milestone);
                    }
                    return milestones;
                }

                function getTransactions( arr ){
                    var transactions = [];

                    for (var i =0; i< arr.length;i++){
                        var transaction = { };

                        if(checkValue(arr[i].source)){transaction.source = arr[i].source;}
                        if(checkValue(arr[i].date)){transaction.date = dateString(arr[i].date);}

                        transaction.value = { };
                        if(checkValue(arr[i].value_amount)){transaction.value.amount = Number(arr[i].value_amount);}
                        if(checkValue(arr[i].currency)){transaction.value.currency = arr[i].currency;}

                        transaction.providerOrganization = { };
                        if(checkValue(arr[i].providerorganization_scheme)){transaction.providerOrganization.scheme = arr[i].providerorganization_scheme;}
                        if(checkValue(arr[i].providerorganization_id)){transaction.providerOrganization.id = arr[i].providerorganization_id;}
                        if(checkValue(arr[i].providerorganization_legalname)){transaction.providerOrganization.legalName = arr[i].providerorganization_legalname;}
                        if(checkValue(arr[i].providerorganization_uri)){transaction.providerOrganization.uri = arr[i].providerorganization_uri;}


                        transaction.receiverOrganization = { };
                        if(checkValue(arr[i].receiverorganization_scheme)){transaction.receiverOrganization.scheme = arr[i].receiverorganization_scheme;}
                        if(checkValue(arr[i].receiverorganization_id)){transaction.receiverOrganization.id = arr[i].receiverorganization_id;}
                        if(checkValue(arr[i].receiverorganization_legalname)){transaction.receiverOrganization.legalName = arr[i].receiverorganization_legalname;}
                        if(checkValue(arr[i].receiverorganization_uri)){transaction.receiverOrganization.uri = arr[i].receiverorganization_uri;}

                        if(checkValue(arr[i].uri)){transaction.uri = arr[i].uri;}

                        deleteNullProperties(transaction, true);

                        transactions.push(transaction);
                    }
                    return transactions;
                }

                function getAmendmentChanges( arr ){
                    var changes = [];
                    for (var i=0; i < arr.length;i++){
                        changes.push({
                            property: arr[i].property,
                            former_value: arr[i].former_value
                        });
                    }
                    return changes;
                }


                //RELEASE METADATA
                var release = {
                    ocid: String(data[0].cp.ocid),
                    id: "RELEASE_" + data[0].cp.ocid + "_" + (new Date()).toISOString(),
                    date: dateString( data[0].cp.fecha_creacion ),
                    tag: ["contract"],
                    initiationType: "tender"
                };

                //PLANNING
                release.planning = { };

                release.planning.budget = { };
                if (checkValue(data[0].budget.budget_source)){release.planning.budget.source = data[0].budget.budget_source;}
                if (checkValue(data[0].budget.budget_budgetid)){release.planning.budget.id = data[0].budget.budget_budgetid;}
                if (checkValue(data[0].budget.budget_description)){release.planning.budget.description = data[0].budget.budget_description;}

                release.planning.budget.amount = { };
                if (checkValue(data[0].budget.budget_amount)){release.planning.budget.amount.amount = Number(data[0].budget.budget_amount);}
                if (checkValue(data[0].budget.budget_currency)){release.planning.budget.amount.currency = data[0].budget.budget_currency;}

                if (checkValue(data[0].budget.budget_project)){release.planning.budget.project = data[0].budget.budget_project;}
                if (checkValue(data[0].budget.budget_projectid)){release.planning.budget.projectID = data[0].budget.budget_projectid;}
                if (checkValue(data[0].budget.budget_uri)){release.planning.budget.uri = data[0].budget.budget_uri;}

                if (checkValue(data[0].planning.rationale)){release.planning.rationale = data[0].planning.rationale;}

                //planning documents
                if (data[4].length > 0){
                    release.planning.documents = getDocuments(data[4])
                }

                //Limpia la etapa de planeación
                deleteNullProperties(release.planning, true);

                // planning == {} -> eliminar
                if (JSON.stringify(release.planning) === JSON.stringify({})){
                    delete release['planning'];
                }

                //TENDER
                release.tender = { };
                if(checkValue(data[0].tender.tenderid)){release.tender.id = data[0].tender.tenderid;}
                if(checkValue(data[0].tender.title)){release.tender.title = data[0].tender.title;}
                if(checkValue(data[0].tender.description)){release.tender.description = data[0].tender.description;}
                if(checkValue(data[0].tender.status)){release.tender.status = data[0].tender.status;}

                //Tender -> items
                if (data[9].length > 0) {
                    release.tender.items = getItems(data[9]);
                }

                release.tender.minValue = { };
                if(checkValue(data[0].tender.minvalue_amount)){release.tender.minValue.amount = Number (data[0].tender.minvalue_amount);}
                if(checkValue(data[0].tender.minvalue_currency)){release.tender.minValue.currency = data[0].tender.minvalue_currency;}

                release.tender.value = { };
                if(checkValue(data[0].tender.value_amount)){release.tender.value.amount = Number (data[0].tender.value_amount);}
                if(checkValue(data[0].tender.value_currency)){release.tender.value.currency = data[0].tender.value_currency;}


                function pm ( method ) {

                    var proc ='';

                    switch (method){

                        case 'Licitación pública':
                            proc = 'open';
                            break;
                        case 'Invitación a tres':
                            proc = 'selective';
                            break;
                        case 'Adjudicación directa':
                            proc = 'limited';
                            break;
                        case 'Contrataciones ASA':
                            proc= 'open';
                            break;
                        case 'Convenio de colaboración':
                            proc= 'open';
                            break;
                    }

                    return proc;

                }

                if(checkValue(data[0].tender.procurementmethod)){release.tender.procurementMethod = pm(data[0].tender.procurementmethod);}
                if(checkValue(data[0].tender.procurementmethod_rationale)){release.tender.procurementMethodRationale = data[0].tender.procurementmethod_rationale;}

                //metodo de adquisición
                if(checkValue(data[0].tender.procurementmethod)){release.tender.metodoDeAdquisicion = data[0].tender.procurementmethod;}

                if(checkValue(data[0].tender.awardcriteria)){release.tender.awardCriteria = data[0].tender.awardcriteria;}
                if(checkValue(data[0].tender.awardcriteria_details)){release.tender.awardCriteriaDetails = data[0].tender.awardcriteria_details;}

                //submission method (Falta homologar)
                if(checkValue(data[0].tender.submissionmethod)){release.tender.submissionMethod = [ data[0].tender.submissionmethod ];}
                if(checkValue(data[0].tender.submissionmethod_details)){release.tender.submissionMethodDetails = data[0].tender.submissionmethod_details;}

                release.tender.tenderPeriod = { };
                if(checkValue(data[0].tender.tenderperiod_startdate)){release.tender.tenderPeriod.startDate = dateString(data[0].tender.tenderperiod_startdate);}
                if(checkValue(data[0].tender.tenderperiod_enddate)){release.tender.tenderPeriod.endDate = dateString(data[0].tender.tenderperiod_enddate);}


                release.tender.enquiryPeriod = { };
                if(checkValue(data[0].tender.enquiryperiod_startdate)){release.tender.enquiryPeriod.startDate = dateString(data[0].tender.enquiryperiod_startdate);}
                if(checkValue(data[0].tender.enquiryperiod_enddate)){release.tender.enquiryPeriod.endDate = dateString(data[0].tender.enquiryperiod_enddate);}

                if(checkValue(data[0].tender.hasenquiries)){release.tender.hasEnquiries = (data[0].tender.hasenquiries > 0);}
                if(checkValue(data[0].tender.eligibilitycriteria)){release.tender.eligibilityCriteria = data[0].tender.eligibilitycriteria;}

                release.tender.awardPeriod = { };
                if(checkValue(data[0].tender.tenderperiod_startdate)){release.tender.awardPeriod.startDate = dateString(data[0].tender.tenderperiod_startdate);}
                if(checkValue(data[0].tender.tenderperiod_enddate)){release.tender.awardPeriod.endDate = dateString(data[0].tender.tenderperiod_enddate);}

                if(checkValue(data[0].tender.numberoftenderers)){release.tender.numberOfTenderers = data[0].tender.numberoftenderers;}

                if (data[1].length > 0) {
                    release.tender.tenderers = getOrganizations(data[1]);
                }

                // Tender -> procuring entity
                release.tender.procuringEntity = (getOrganizations( [ data[0].procuringentity ]))[0];

                if( data[5].length > 0) {
                    release.tender.documents = getDocuments(data[5]);
                }
                if (data[12].length > 0 ) {
                    release.tender.milestones = getMilestones(data[12]);
                }

                release.tender.amendment = { };
                if(checkValue(data[0].tender.amendment_date)){release.tender.amendment.date = dateString(data[0].tender.amendment_date);}


                if( data[15].length > 0 ) {
                    release.tender.amendment.changes = getAmendmentChanges(data[15]);
                }

                if (checkValue(data[0].tender.amendment_rationale)){release.tender.amendment.rationale = data[0].tender.amendment_rationale;}

                //limpia la etapa de licitación
                deleteNullProperties( release.tender, true );

                if (JSON.stringify(release.tender) === JSON.stringify({})){
                    delete release['tender'];
                }

                //BUYER
                release.buyer = (getOrganizations( [ data[0].buyer ]) )[0];

                //AWARDS
                var award =  { };
                if(checkValue(data[0].award.awardid)){award.id = data[0].award.awardid;}
                if(checkValue(data[0].award.title)){award.title = data[0].award.title;}
                if(checkValue(data[0].award.description)){award.description = data[0].award.description;}
                if(checkValue(data[0].award.status)){award.status = data[0].award.status;}
                if(checkValue(data[0].award.award_date)){award.date = dateString(data[0].award.award_date);}

                award.value = { };
                if(checkValue(data[0].award.value_amount)){award.value.amount = Number(data[0].award.value_amount);}
                if(checkValue(data[0].award.value_currency)){award.value.currency = data[0].award.value_currency;}


                if (data[2].length > 0) {
                    award.suppliers = getOrganizations(data[2]); //pueden pertenecer a diferentes awards
                }

                if (data[10].length > 0) {
                    award.items = getItems(data[10]);
                }

                award.contractPeriod = { };
                if(checkValue(data[0].award.contractperiod_startdate)){award.contractPeriod.startDate = dateString(data[0].award.contractperiod_startdate);}
                if(checkValue(data[0].award.contractperiod_enddate)){award.contractPeriod.endDate = dateString(data[0].award.contractperiod_enddate);}

                if (data[6].length > 0) {
                    award.documents = getDocuments(data[6]);
                }

                award.amendment = { };
                if(checkValue(data[0].award.amendment_date)){award.amendment.date = dateString(data[0].award.amendment_date);}


                if (data[16].length > 0) {
                    award.amendment.changes = getAmendmentChanges(data[16]);
                }

                if(checkValue(data[0].award.amendment_rationale)){award.amendment.rationale = data[0].award.amendment_rationale;}

                //limpia la adjudicación
                deleteNullProperties( award, true );

                if (JSON.stringify(award) !== JSON.stringify({})){
                    release. awards = [ award ];
                }

                //CONTRACTS
                var contract = { };//pueden ser varios

                if(checkValue(data[0].contract.contractid)){contract.id = data[0].contract.contractid;}
                if(checkValue(data[0].contract.awardid)){contract.awardID = String(data[0].contract.awardid);}
                if(checkValue(data[0].contract.title)){contract.title = data[0].contract.title;}
                if(checkValue(data[0].contract.description)){contract.description = data[0].contract.description;}
                if(checkValue(data[0].contract.status)){contract.status = data[0].contract.status;}

                contract.period = { };
                if(checkValue(data[0].contract.period_startdate)){contract.period.startDate = dateString(data[0].contract.period_startdate);}
                if(checkValue(data[0].contract.period_enddate)){contract.period.endDate = dateString(data[0].contract.period_enddate);}

                contract.value = { };
                if(checkValue(data[0].contract.value_amount)){contract.value.amount = Number(data[0].contract.value_amount);}
                if(checkValue(data[0].contract.value_currency)){contract.value.currency = data[0].contract.value_currency;}

                if (data[11].length > 0) {
                    contract.items = getItems(data[11]);
                }

                if(checkValue(data[0].contract.datesigned)){contract.dateSigned = dateString(data[0].contract.datesigned);}

                if (data[7].length > 0) {
                    contract.documents = getDocuments(data[7]);
                }

                contract.amendment = { };

                if(checkValue(data[0].contract.amendment_date)){contract.amendment.date = dateString(data[0].contract.amendment_date);}

                if (data[17].length > 0) {
                    contract.amendment.changes = getAmendmentChanges(data[17]);
                }

                if(checkValue(data[0].contract.amendment_rationale)){contract.amendment.rationale = data[0].contract.amendment_rationale;}

                //IMPLEMENTATION
                contract.implementation = { };
                if (data[14].length > 0) {
                    contract.implementation.transactions = getTransactions(data[14]);
                }

                if (data[13].length > 0) {
                    contract.implementation.milestones = getMilestones(data[13]);
                }

                if (data[8].length > 0) {
                    contract.implementation.documents = getDocuments(data[8]);
                }

                //limpia: Contract -> implementation
                deleteNullProperties( contract, true );

                if (JSON.stringify(contract) !== JSON.stringify({})){
                    release.contracts = [ contract ];
                }

                release.language = 'es';

                if (type =="release-package"){

                    var publisher = {
                        name: data[3].name,
                        scheme: data[3].scheme,
                        uid: data[3].uid,
                        uri: data[3].uri
                    };

                    deleteNullProperties(publisher, true);


                    var record = {};

                    record.uri = data[0].cp.uri;//"http://datos.gob.mx/busca/organization/gacm",
                    record.publishedDate = (new Date).toISOString();//getMString(new Date()),
                    record.releases = [ release ];
                    record.publisher = publisher;
                    record.license = data[0].cp.license;//"http://datos.gob.mx/libreusomx",
                    record.publicationPolicy = data[0].cp.publicationpolicy;//"http://dof.gob.mx/nota_detalle.php?codigo=5391143&fecha=04/05/2015",
                    record.localid  = localid;

                    deleteNullProperties(record, false);

                    return record;
                }

                release.localid = localid;
                return release ;

            })
        });
    }
};