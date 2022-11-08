//ARCHIVE DU SERVEUR FONCTIONNANT AVEC DES PARAMETRES (parametres concernant les dates et les lieux notamment)
//REMPLACE DANS L'INDEX.JS PAR LE FICHIER QUERIES QUI LUI N'EST PAS PARAMETRIQUE MAIS RENVOIE TOUTES LES DONNEES D'UN NUMERO DE PERSONNE ENTRE

//Concernant les dates valant NA dans la BDD, elles ne sont pas récupérées via les requêtes puisqu'elles ne sont pas traitables dans l'application puisque le déroulement temporel est un élément central
//COncernant les pays, ils ne sont pas non plus récupérés pour le moment puisqu'ils sont tous NA étant donné que nous avons aucune information concernant quel pays correspond à quel code dans l'enquête
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

  //Variables servant à fixer les bornes temporelles, initialisées pour avoir tout au début
  //Mais sont modifiées si la requete contient des dates différentes
  let dateMin = 1854;
  let dateMax = 2000;

  let departements = ""; //Une string qu'on va alimenter avec les conditions de départements sélectionnés
  let communes = ""; //Même chose pour les communes

  let id = parseInt(req.params.id); //On récupère l'id de la personne dans la requete envoyée au serveur

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

    //Ici on va récupérer les paramètres de date passés dans la requete, et les vérifier
    let paramDateMin = req.query.dateMin;

    //Si le param passé n'est pas undefined et qu'il est compris entre 1854 et la dateMax
    if (
      typeof paramDateMin !== "undefined" &&
      paramDateMin > 1854 &&
      paramDateMin < dateMax
    ) {
      dateMin = paramDateMin; //On passe le paramètre à notre variable de borne basse
      console.log("Changement de la date minimum, nouvelle date : " + dateMin);
    }

    //On va faire les mêmes vérifications pour la borne haute
    let paramDateMax = req.query.dateMax;
    //Ici on regarde si la date passée est bien supérieure à la date basse entrée juste avant, ce qui évite d'avoir des périodes avec une borne basse supérieure à la haute et inversement
    if (
      typeof paramDateMax !== "undefined" &&
      paramDateMax > dateMin &&
      paramDateMax < 2001
    ) {
      dateMax = paramDateMax;
      console.log("Changement de la date maximum, nouvelle date : " + dateMax);
    }

    //On récupère le paramètre contenant les départements
    let paramDpt = req.query.dpt;
    //Et on teste pour vérifier qu'il contient bien des informations, pour pouvoir les parser
    if (typeof paramDpt !== "undefined") {
      paramDpt = JSON.parse(req.query.dpt); //On récupère les informations en parsant

      if (Array.isArray(paramDpt) && paramDpt.length !== 0) {
        //Et on vérifie que ce qu'on a récupéré est un tableau pour itérer dessus
        console.log(
          "Requete limitée à certains départements, numéros : " + paramDpt
        );
        departements = await buildDepartementParam(paramDpt); //On vient construire le paramètre
      }
    }

    //On applique la même logique que pour les départements mais pour les communes cette fois
    let paramCom = req.query.com;
    if (typeof paramCom !== "undefined") {

      if (Array.isArray(paramCom) && paramCom.length !== 0) {
        console.log("Requete limitée à certaines communes : " + paramCom);
        communes = await buildCommuneParam(paramCom);
      }
    };
    //On crée un tableau avec les paramètres à passer à la requete faite à la db, et un tableau avec les strings qu'on va concaténer à la requete
    //(la méthode .query ne prend pas de string en paramètre, donc il faut séparer)
    let paramsRequete = [id, dateMin, dateMax];
    let stringsRequete = [departements, communes];
    //On attend la fin de chaque fonction requete pour tout bien récupérer avant de renvoyer la réponse
    await getResidential(paramsRequete, stringsRequete);
    await getFamilial(paramsRequete, stringsRequete);
    await getProfessional(paramsRequete, stringsRequete);
    await getLeisure(paramsRequete, stringsRequete);
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
 * @param {*} paramsRequete les paramètres de sélection pour la requete de la db
 */
async function getResidential(paramsRequete, stringsRequete) {
  console.log(
    "On passe dans la fonction rési, paramètres : " +
    paramsRequete +
    "\nConditions de lieux : " +
    stringsRequete +
    "\n"
  );

  //Requete envoyée au serveur pour récupérer les évènements résidentiels de la personne
  let requeteResEvents =
    "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, fk_ref_loc as loc, 'habitat' as type_event, annee as annee FROM residential_event WHERE personne = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3" +
    "UNION SELECT to_number(rang,'99G999D9S') as rang, fk_ref_loc as loc, 'etudes' as type_event, annee as annee FROM professionnal_event WHERE personne = $1 AND annee != 'NA' AND type_event='Etude' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3" +
    "UNION SELECT to_number(rang,'99G999D9S') as rang, fk_ref_loc as loc,  'naissance' as type_event, annee as annee FROM familial_event WHERE type_event='Naissance ego' AND personne = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3 ORDER by annee, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  //Requete envoyée au serveur pour récupérer les épisodes résidentiels
  let requeteResEpisodes = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, type_episode, date_debut, date_fin, fk_ref_loc as loc FROM residential_episode WHERE (date_debut != 'NA' OR date_fin != 'NA') AND personne = $1 AND to_number(date_debut,'99G999D9S') > $2 AND to_number(date_debut,'99G999D9S') < $3 ORDER BY date_debut, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  //Appel de la fonction requete avec seulement un id principal
  await request(requeteResEpisodes, paramsRequete, "residential", "episode");
  await request(requeteResEvents, paramsRequete, "residential", "event");
}

/**
 * Renvoie un objet contenant les informations familiales de la personne (mariage, enfants, parents et conjoint)
 * L'objet est identifié par l'id "familial" et possèdes des sous catégories pour les enfants, parents et conjoint
 *
 * @param {*} paramsRequete les paramètres de sélection pour la requete de la db
 */
async function getFamilial(paramsRequete, stringsRequete) {
  console.log(
    "On passe dans la fonction familial, paramètres : " +
    paramsRequete +
    "\nConditions de lieux : " +
    stringsRequete +
    "\n"
  );

  //On fait une requete pour chaque sous-dimension du familial, ce qui va trier facilement et éviter les problèmes de rang similaires
  //Et faciliter le travail de traitement dans le frontend
  let requeteFamilialEpisodes = "SELECT date_debut, date_fin, nbenfant, nbparent, statut_matrimonial FROM familial_episode WHERE (date_debut != 'NA' OR date_fin != 'NA') AND personne = $1 AND to_number(date_debut,'99G999D9S') > $2 AND to_number(date_debut,'99G999D9S') < $3 ORDER BY date_debut"

  let requeteFamilialMariage =
    "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_event, fk_ref_loc as loc FROM familial_event WHERE personne = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  let requeteFamilialChildren =
    "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_lieu, fk_ref_loc as loc FROM enfant WHERE fk_personne_id = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  let requeteFamilialParents =
    "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_lieu, fk_ref_loc as loc FROM parent WHERE fk_personne_id = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  let requeteFamilialPartner =
    "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT annee, type_lieu, fk_ref_loc as loc FROM conjoint WHERE fk_personne_id = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3 ORDER BY annee) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  //Appel de la fonction de requete pour chaque sous-objet de la dimension familiale, donc on passe également un idSecondaire (au lieu de null ailleurs)
  await request(requeteFamilialEpisodes, paramsRequete, "familial", "episode");
  await request(requeteFamilialMariage, paramsRequete, "familial", "event");
  await request(requeteFamilialChildren, paramsRequete, "familial", "children");
  await request(requeteFamilialParents, paramsRequete, "familial", "parents");
  await request(requeteFamilialPartner, paramsRequete, "familial", "partner");
}

/** Fonction qui récupère les informations pro dans la db et les place dans l'objet json réponse, avec l'id 'pro'
 *
 * @param {*} paramsRequete les paramètres de sélection pour la requete de la db
 */
async function getProfessional(paramsRequete, stringsRequete) {
  console.log(
    "On passe dans la fonction pro, paramètres : " +
    paramsRequete +
    "\nConditions de lieux : " +
    stringsRequete +
    "\n"
  );

  let requeteProEvents = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_event, fk_ref_loc as loc FROM professionnal_event WHERE personne = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  let requeteProEpisodes =
    "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, type_episode, date_debut, date_fin, fk_ref_loc as loc FROM professionnal_episode WHERE type_episode='Emploi' AND (date_debut != 'NA' OR date_fin != 'NA') AND personne = $1 AND to_number(date_debut,'99G999D9S') > $2 AND to_number(date_debut,'99G999D9S') < $3 ORDER BY date_debut, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];

  //Appel de la fonction requete avec seulement un id principal
  await request(requeteProEpisodes, paramsRequete, "professional", "episode");
  await request(requeteProEvents, paramsRequete, "professional", "event");
}

/** Récupère les informations des voyages d'une personne donnée et les place dans la réponse JSON avec l'id 'leisure'
 *
 * @param {*} paramsRequete les paramètres de sélection pour la requete de la db
 */
async function getLeisure(paramsRequete, stringsRequete) {
  console.log(
    "On passe dans la fonction voyages, paramètres : " +
    paramsRequete +
    "\nConditions de lieux : " +
    stringsRequete +
    "\n"
  );

  let requeteLeisureEvents = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, annee, type_event, fk_ref_loc as loc FROM leisure_event WHERE personne = $1 AND annee != 'NA' AND to_number(annee,'99G999D9S') > $2 AND to_number(annee,'99G999D9S') < $3 ORDER BY annee, rang) as requete WHERE requete.loc = pk_ref_loc " +
    stringsRequete[0] +
    stringsRequete[1];
  ;

  let requeteLeisureEpisodes = "SELECT requete.*, latitude, longitude, departement, commune, code_geographique FROM localisation, (SELECT to_number(rang,'99G999D9S') as rang, date_debut, date_fin, type_episode, fk_ref_loc as loc FROM leisure_episode WHERE personne = $1 AND (date_debut != 'NA' OR date_fin != 'NA') AND to_number(date_debut,'99G999D9S') > $2 AND to_number(date_debut,'99G999D9S') < $3 ORDER BY date_debut, rang) as requete WHERE requete.loc = pk_ref_loc" + stringsRequete[0] + stringsRequete[1];

  //Appel de la fonction requete avec seulement un id principal
  await request(requeteLeisureEpisodes, paramsRequete, "leisure", "episode");
  await request(requeteLeisureEvents, paramsRequete, "leisure", "event");
}

/**
 * Fonction de factorisation qui va effectuer la requete SQL auprès de la db, donc qu'on va appeler pour chaque requete dans les fonctions au-dessus
 *
 * @param {String} requete la requete postGre a envoyer à la db
 * @param {*} paramsRequete les paramètres de sélection pour la requete de la db
 * @param {String} idPrincipalReponse id auquel on va mettre les données dans la réponse
 * @param {String} idSecondaireReponse si besoin l'id du sous objet (utile dans familial notamment)
 */
async function request(
  requete,
  paramsRequete,
  idPrincipalReponse,
  idSecondaireReponse
) {
  console.log('Entrée dans la requete pour : ' + idPrincipalReponse + "." + idSecondaireReponse);
  //console.log("Passage dans la fction de requete, paramètres : " + paramsRequete)
  let colonnes = (await pool.query(requete, paramsRequete)).rows; //On attend la fin de la requete et on met les rows dans une fonction

  if (responseJSON[idPrincipalReponse] === undefined) {
    //Si l'id principal de notre requete n'est pas encore défini, on le définit ici
    responseJSON[idPrincipalReponse] = {};
  }

  //Ensuite on vient placer dans le sous-id les colonnes résultats de la requete
  responseJSON[idPrincipalReponse][idSecondaireReponse] = colonnes; //On place ces colonnes dans l'objet avec l'id principal + l'id secondaire

};

/** Méthode qui construit une string contenant les conditions postgres à ajouter pour ne sélectionner que les
 * départements passés en paramètre
 *
 * @param {array} paramDpt tableau contenant les numéros des départements sélectionnés dans le frontend
 * @returns une string contenant les conditions de sélection des départements
 */
async function buildDepartementParam(paramDpt) {
  let res = " AND ("; //Initialisation du résultat à renvoyer

  //Parcours du tableau de départements
  paramDpt.forEach((dpt, index) => {
    res += `departement = '${dpt}'`; //On ajoute la condition pour chaque département

    //Tant qu'on est pas au dernier dpt
    if (index !== paramDpt.length - 1) {
      res += " OR "; //On ajoute le terme de liaison des conditions
    } else {
      //Quand on est au dernier élément du tableau
      res += ")"; //On termine la condition
    }
  });
  return res;
}

/** Méthode qui construit une string contenant les conditions postgres à ajouter pour ne sélectionner que les
 * communes passées en paramètre
 *
 * @param {*} paramCom tableau contenant les communes sélectionnées dans le frontend
 * @returns une string contenant les conditions de sélection des communes
 */
async function buildCommuneParam(paramCom) {
  let res = " AND ("; //Initialisation résultat

  paramCom.forEach((com, index) => {

    //Ce bloc sert à régler un problème qui se pose quand la commune qu'on veut passer en condition contient une simple quote, postgre la comprend comme une fin de string
    //Dans ce cas, il faut placer une seconde simple quote juste après pour que postgre comprenne bien que c'est un char et pas une fin de string
    if (com.indexOf("'") !== -1) {
      let quote = com.indexOf("'");

      com = com.slice(0, quote) + "'" + com.slice(quote);
    };

    //Parcours des communes
    res += `commune = '${com}'`; //On construit chaque condition de commune

    if (index !== paramCom.length - 1) {
      //Entre chaque on ajoute le OR
      res += " OR ";
    } else {
      res += ")"; //A la fin on termine la condition
    }
  });
  return res;
}
//On exporte la fonction pour qu'elle soit utilisée dans l'index.js
module.exports = {
  getData,
};
