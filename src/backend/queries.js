//Concernant les dates valant NA dans la BDD, elles ne sont pas récupérées via les requêtes puisqu'elles ne sont pas traitables dans l'application puisque le déroulement temporel est un élément central
//Concernant les pays, ils ne sont pas non plus récupérés pour le moment puisqu'ils sont tous NA étant donné que nous avons aucune information concernant quel pays correspond à quel code dans l'enquête
/* eslint-disable prettier/prettier */
const { response } = require("express");
const res = require("express/lib/response");
const Pool = require("pg").Pool;

//Connexion à la db
const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "TER_db_3B",
    password: "admin",
    port: 5432,
});

let responseJSON = {}; //L'objet qu'on va alimenter avec les résultats des requêtes et renvoyer

/**
 * Fonction qui va aller récupérer les informations de la personne demandée,
 * et renvoyer une réponse sous forme de json contenant 4 objets avec les infos
 * dans les 4 dimensions principales
 *
 * @param {*} req requete recue, notamment avec l'id de la personne
 * @param {*} response réponse envoyée
 */
async function getData(req, response) {
    console.log("Récupération des informations d'une personne");

    let id = [];
    id.push(parseInt(req.params.id)); //On récupère l'id de la personne dans la requete envoyée au serveur

    //Si l'id n'est pas entre 5000 et 9904 ou que c'est un NaN
    if (id < 5000 || id > 9904 || isNaN(id)) {
        console.log("User input invalide");
        response.status(400).json({
            //On renvoie une réponse d'erreur
            error: "InvalidUserInput",
            message: "Identifiant entré invalide",
        });
    } else {
        //Dans les cas où c'est bon on passe à la suite du traitement de la requete

        //On attend la fin de chaque fonction requete pour tout bien récupérer avant de renvoyer la réponse
        await getResidential(id);
        await getFamilial(id);
        await getProfessional(id);
        await getLeisure(id);
        console.log('Sortie des fonctions');
        response.status(200).json(responseJSON); //On renvoie l'objet qu'on a construit avec les requetes

        console.log("\n--------------------------------------------");
        console.log("------------FIN DE LA REQUETE---------------");
        console.log("--------------------------------------------");
    }
}

/**
 * Renvoie un objet contenant toutes les informations résidentielles de la personne, et les place dans le JSON réponse avec l'id 'residential'
 *
 * @param {*} id les paramètres de sélection pour la requete de la db
 */
async function getResidential(id) {
    console.log(
        "On passe dans la fonction rési, paramètres : " +
        id
    );

    //Requete envoyée au serveur pour récupérer les évènements résidentiels de la personne
    let requeteResEvents =
        "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, fk_ref_loc as loc, type_event, annee as annee FROM residential_event WHERE personne = $1" +
        "UNION SELECT to_number(rang,'99G999D9S') as rang, fk_ref_loc as loc, 'etudes' as type_event, annee as annee FROM professionnal_event WHERE type_event = 'Studies' AND personne = $1" +
        "UNION SELECT to_number(rang,'99G999D9S') as rang, fk_ref_loc as loc,  type_event, annee as annee FROM familial_event WHERE type_event='Birth' AND personne = $1 ORDER by annee, rang) as requete WHERE requete.loc = pk_ref_loc ";

    //Requete envoyée au serveur pour récupérer les épisodes résidentiels
    let requeteResEpisodes = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, type_episode, date_debut, date_fin, fk_ref_loc as loc FROM residential_episode WHERE personne = $1 ORDER BY date_debut, rang) as requete WHERE requete.loc = pk_ref_loc ";

    //Appel de la fonction requete avec seulement un id principal
    await request(requeteResEpisodes, id, "residential", "episode");
    await request(requeteResEvents, id, "residential", "event");
}

/**
 * Renvoie un objet contenant les informations familiales de la personne (mariage, enfants, parents et conjoint)
 * L'objet est identifié par l'id "familial" et possèdes des sous catégories pour les enfants, parents et conjoint
 *
 * @param {*} id les paramètres de sélection pour la requete de la db
 */
async function getFamilial(id) {
    console.log(
        "On passe dans la fonction familial, paramètres : " +
        id
    );

    //On fait une requete pour chaque sous-dimension du familial, ce qui va trier facilement et éviter les problèmes de rang similaires
    //Et faciliter le travail de traitement dans le frontend
    let requeteFamilialEpisodes = "SELECT date_debut, date_fin, nbenfant, nbparent, statut_matrimonial FROM familial_episode WHERE personne = $1 ORDER BY date_debut";

    let requeteFamilialMariage =
        "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_event, fk_ref_loc as loc FROM familial_event WHERE personne = $1 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc ";

    let requeteFamilialChildren =
        "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_lieu, fk_ref_loc as loc FROM enfant WHERE fk_personne_id = $1 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc ";

    let requeteFamilialParents =
        "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_lieu, fk_ref_loc as loc FROM parent WHERE fk_personne_id = $1 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc ";

    let requeteFamilialPartner =
        "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT annee, type_lieu, fk_ref_loc as loc FROM conjoint WHERE fk_personne_id = $1 ORDER BY annee) as requete WHERE requete.loc = pk_ref_loc ";

    //Appel de la fonction de requete pour chaque sous-objet de la dimension familiale, donc on passe également un idSecondaire (au lieu de null ailleurs)
    await request(requeteFamilialEpisodes, id, "familial", "episode");
    await request(requeteFamilialMariage, id, "familial", "event");
    await request(requeteFamilialChildren, id, "familial", "children");
    await request(requeteFamilialParents, id, "familial", "parents");
    await request(requeteFamilialPartner, id, "familial", "partner");
}

/** Fonction qui récupère les informations pro dans la db et les place dans l'objet json réponse, avec l'id 'pro'
 *
 * @param {*} id les paramètres de sélection pour la requete de la db
 */
async function getProfessional(id) {
    console.log(
        "On passe dans la fonction pro, paramètres : " +
        id
    );

    let requeteProEvents = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_event, fk_ref_loc as loc FROM professionnal_event WHERE personne = $1   ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc ";

    let requeteProEpisodes =
        "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, type_episode, date_debut, date_fin, fk_ref_loc as loc FROM professionnal_episode WHERE type_episode='Work' AND personne = $1 ORDER BY date_debut, rang) as requete WHERE requete.loc = pk_ref_loc ";

    //Appel de la fonction requete avec seulement un id principal
    await request(requeteProEpisodes, id, "professional", "episode");
    await request(requeteProEvents, id, "professional", "event");
}

/** Récupère les informations des voyages d'une personne donnée et les place dans la réponse JSON avec l'id 'leisure'
 *
 * @param {*} id les paramètres de sélection pour la requete de la db
 */
async function getLeisure(id) {
    console.log(
        "On passe dans la fonction voyages, paramètres : " +
        id
    );

    let requeteLeisureEvents = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_event, fk_ref_loc as loc FROM leisure_event WHERE personne = $1   ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc ";
    ;

    let requeteLeisureEpisodes = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, date_debut, date_fin, type_episode, fk_ref_loc as loc FROM leisure_episode WHERE personne = $1   ORDER BY date_debut, rang) as requete WHERE requete.loc = pk_ref_loc";

    //Appel de la fonction requete avec seulement un id principal
    await request(requeteLeisureEpisodes, id, "leisure", "episode");
    await request(requeteLeisureEvents, id, "leisure", "event");
}

/**
 * Fonction de factorisation qui va effectuer la requete SQL auprès de la db, donc qu'on va appeler pour chaque requete dans les fonctions au-dessus
 *
 * @param {String} requete la requete postGre a envoyer à la db
 * @param {*} id les paramètres de sélection pour la requete de la db
 * @param {String} idPrincipalReponse id auquel on va mettre les données dans la réponse
 * @param {String} idSecondaireReponse si besoin l'id du sous objet (utile dans familial notamment)
 */
async function request(
    requete,
    id,
    idPrincipalReponse,
    idSecondaireReponse
) {
    console.log('Entrée dans la requete pour : ' + idPrincipalReponse + "." + idSecondaireReponse);
    //console.log("Passage dans la fction de requete, paramètres : " + id)
    let colonnes = (await pool.query(requete, id)).rows; //On attend la fin de la requete et on met les rows dans une fonction

    if (responseJSON[idPrincipalReponse] === undefined) {
        //Si l'id principal de notre requete n'est pas encore défini, on le définit ici
        responseJSON[idPrincipalReponse] = {};
    }

    //Ensuite on vient placer dans le sous-id les colonnes résultats de la requete
    responseJSON[idPrincipalReponse][idSecondaireReponse] = colonnes; //On place ces colonnes dans l'objet avec l'id principal + l'id secondaire

};

//On exporte la fonction pour qu'elle soit utilisée dans l'index.js
module.exports = {
    getData,
};
