import { defineStore } from "pinia";
import axios from "axios";

export const useDataStore = defineStore("DataStore", {
  state: () => ({
    individual_number: "",
    info: {},

    //Variables used to store the raw data from the JSON
    //They are kept because they contain metadata on the person trahectory, like the number of times a city appears for example
    data_activity_list: [], // liste des activités
    data_city_list: [], // liste des villes
    //country_list: [], // liste des pays
    data_departement_list: [], // liste des departements
    data_number_of_parents: [], // Liste du nombre de parents en vie (de 2 à 0)
    data_parents_rank: [], //Rang des parents (1 et 2)
    data_number_of_children: [], // Liste du nombre d'enfant (de 0 à nbMax)
    data_children_rank: [], //Rang des enfants (de 1 à nbMax)
    data_marital_status: [], //liste des status maritaux
    data_leisure_rank: [], // liste des rangs des voyages
    data_professional_rank: [], // liste des rangs des professions
    data_professional_activity: [], //Les types d'activités pro occupées
    data_residential_rank: [], // liste des rangs des communes de résidence

    //Variables used to fill the selection menu with the person data, duplicate elements appear only once
    menu_city_list: [], // liste des villes
    //menu_country_list: [], // liste des pays
    menu_departement_list: [], // liste des departements
    menu_number_of_parents: [], // liste du nombre de parents
    menu_parent_rank: [], //Rang d'un parent en particulier
    menu_number_of_children: [], // liste du nombre d'enfants
    menu_children_rank: [], //Rang d'un enfant en particulier
    menu_marital_status: [], //liste des status
    menu_leisure_rank: [], // liste des rangs des voyages
    menu_professional_rank: [], // liste des rangs des professions
    menu_residential_rank: [], // liste des rangs des communes de résidence
    menu_professional_activity: [], // liste des activités

    //Variables used in the server request, they contain info on temporal and spatial filter
    dateMin: "", //Dates servant de bornes de sélection des éléments affichés
    dateMax: "",
    dpt: [], //Liste des départements sélectionnés par l'user
    com: [], //Liste des communes sélectionnées
    pays: [], //Liste des pays sélectionnés

    //Variables used to store the user selection entered in the menu (checboxes selected for example)
    //They are filled directly by the component checkboxItem, and their name must be the same as the label given to the lists that are passed to the menu
    nb_children: [],
    nb_parents: [],
    data_marital_status: [],
    rank_children: [],
    rank_parents: [],
    res_rank: [],
    pro_activity: [],
    pro_rank: [],
    leisure_rank: [],

    //Variables sent by the component PopupElement, they are used in the Ligne component to display a highlight of the select map episode
    dateBegSelectedEpisode: "",
    dateEndSelectedEpisode: "",
    trajSelectedEpisode: ""
  }),
  // getters
  getters: {
    /** Function that creates an object used to send parameters to the server 
     * 
     * @returns an object {params}
     */
    paramsHttp() {
      let res = {};

      //On ne prend à chaque fois que les éléments qui ne sont pas vides pour ne pas envoyer des paramètres inutiles
      if (this.dateMin !== "" || this.dateMax !== "") {
        res.dateMin = this.dateMin;
        res.dateMax = this.dateMax;
      }

      if (this.dpt.length > 0) {
        res.dpt = this.dpt;
      }

      if (this.com.length > 0) {
        res.com = this.com;
      }

      if (this.pays.length > 0) {
        res.pays = this.pays;
      }

      //On renvoie l'objet en le plaçant dans un autre objet avec le nom params
      return { 'params': res };
    },
  },
  // actions
  actions: {
    /**
     * Function that gets a person data and put them in the variable info, then works on this info to cut it into pieces and put it into the variables for the menu
     */
    async getData() {
      //On envoie la requête serveur seulement si l'id entré a été validé dans le composant individualItem
      if (this.individual_number !== "") {
        await axios
          .get("http://localhost:8000/data/" + this.individual_number, this.paramsHttp)
          .then((response) => {
            let info = response.data;
            this.info = info;


            //A chaque nouvel appel du serveur, on vient vider les variables pour éviter d'avoir des problèmes en les remplissant avec les infos de 2 personnes différentes
            this.data_activity_list = []; // liste des activités
            this.data_city_list = []; // liste des villes
            //country_list: []; // liste des pays
            this.data_departement_list = []; // liste des departements
            this.data_number_of_parents = []; // liste du nombre de parents
            this.data_parents_rank = [];
            this.data_number_of_children = []; // liste du nombre d'enfants
            this.data_children_rank = [];
            this.status_list = []; //liste des status
            this.data_leisure_rank = []; // liste des rangs des voyages
            this.professionnal_rank = []; // liste des rangs des professions
            this.data_residential_rank = []; // liste des rangs des communes de résidence

            this.menu_city_list = []; // liste des villes
            //this.menu_country_list = []; // liste des pays
            this.menu_departement_list = []; // liste des departements
            this.menu_number_of_parents = []; // liste du nombre de parents
            this.menu_parent_rank = []; //Rang d'un parent en particulier
            this.menu_number_of_children = []; // liste du nombre d'enfants
            this.menu_children_rank = []; //Rang d'un enfant en particulier
            this.menu_marital_status = []; //liste des status
            this.menu_leisure_rank = []; // liste des rangs des voyages
            this.menu_professional_rank = []; // liste des rangs des professions
            this.menu_residential_rank = []; // liste des rangs des communes de résidence
            this.menu_professional_activity = []; // liste des activités


            //Ici on va parcourir le JSON pour récupérer les données qu'on va ensuite traiter puis passer au menu
            for (const trajectory in info) { //Parcours du premier niveau du JSON, les 4 trajectoires

              for (const type in info[trajectory]) { //Parcours du 2e niveau, les catégories events/episodes

                for (const el in info[trajectory][type]) { //Parcours des feuilles avec traitement

                  let feuille = info[trajectory][type][el]; //Stockage de la feuille en cours de traitement

                  //Ici on va faire en sorte de ne pas traiter les episodes familiaux, dont la structure est un peu différente
                  if (trajectory !== 'familial' || type !== 'episode') {
                    //Stockage tous départements et villes concernant la personne
                    this.data_departement_list.push(feuille.departement);
                    this.data_city_list.push(feuille.commune);
                    // console.log(trajectory + " " + type);

                    if (trajectory === 'residential') { //On récupère tous les rangs des events + episodes rési
                      this.data_residential_rank.push(feuille.rang);
                    };

                    //Traitement des éléments dans la trajectoire pro
                    if (trajectory === 'professional') {
                      this.data_professional_rank.push(feuille.rang); //On récupère les rangs pour tout

                      if (type === 'episode') { //On récupère les activités pro directement dans les épisodes
                        this.data_professional_activity.push(feuille.type_episode);
                      };
                    };

                    //Traitement des épisodes de voyages etc
                    if (trajectory === 'leisure') {
                      this.data_leisure_rank.push(feuille.rang); //Récupération des rangs 
                    };

                    //Traitement des rangs des enfants et parents, le but est d'avoir un menu qui affiche un sélecteur permettant de choisir un/plusieurs parent ou enfant spécifique, avec un liste qui commence à 1 et pas 0
                    if (type === 'parents') {
                      this.data_parents_rank.push(feuille.rang)
                    };

                    if (type === 'children') {
                      this.data_children_rank.push(feuille.rang);
                    };

                  } else { //Ici on arrive dans le traitement des épisodes familiaux uniquement
                    //Ici on vient récupérer le nb d'enfants que la personne a eu dans sa vie (de 0 à nbMax)
                    //Le nb de parents également (souvent de 2 à 0)
                    this.data_number_of_children.push(feuille.nbenfant);
                    this.data_number_of_parents.push(feuille.nbparent);

                    //Et on vient également récupérer les status matrimoniaux qu'il a eus
                    this.data_marital_status.push(feuille.statut_matrimonial);
                  };
                };
              };
            };


            let ref = 0;
            //Remplissage des variables qui vont être passées au menu pour le compléter, sous forme d'objet avec un tableau d'objets et un label qui identifie l'élement dans le menu
            //Liste des PAYS
            //this.menu_country_list = this.fill_list(this.menu_country_list, this.country_list, "country", 1);

            //Liste des DEPARTEMENTS
            this.menu_departement_list = this.fill_menu_list(
              this.menu_departement_list,
              this.data_departement_list,
              "dpt", ref++);

            //Liste des VILLES
            this.menu_city_list = this.fill_menu_list(
              this.menu_city_list,
              this.data_city_list.sort(), //On trie les villes par ordre alphabétique
              "com", ref++);

            //Liste du nombre d'enfant de la personne
            this.menu_number_of_children = this.fill_menu_list(
              this.menu_number_of_children,
              this.data_number_of_children,
              "nb_children", ref++);

            //Liste du nombre de parents de la personne
            this.menu_number_of_parents = this.fill_menu_list(
              this.menu_number_of_parents,
              this.data_number_of_parents,
              "nb_parents", ref++);

            //Liste des status matrimoniaux
            this.menu_marital_status = this.fill_menu_list(
              this.menu_marital_status,
              this.data_marital_status,
              "data_marital_status", ref++);

            //Liste de choix d'un/de plusieurs enfants précis
            this.menu_children_rank = this.fill_menu_list(
              this.menu_children_rank,
              this.data_children_rank,
              "rank_children", ref++);

            //Liste du nombre de parents de la personne
            this.menu_parent_rank = this.fill_menu_list(
              this.menu_parent_rank,
              this.data_parents_rank,
              "rank_parents", ref++);

            //Liste des rangs des events + episodes residentiels
            this.menu_residential_rank = this.fill_menu_list(
              this.menu_residential_rank,
              this.data_residential_rank,
              "res_rank", ref++);

            //Remplissage de slistes activité et rang du professionnel
            this.menu_professional_activity = this.fill_menu_list(
              this.menu_professional_activity,
              this.data_professional_activity,
              "pro_activity", ref++);

            this.menu_professional_rank = this.fill_menu_list(
              this.menu_professional_rank,
              this.data_professional_rank,
              "pro_rank", ref++);

            //Remplissage de la liste des rangs de leisure
            this.menu_leisure_rank = this.fill_menu_list(
              this.menu_leisure_rank,
              this.data_leisure_rank,
              "data_leisure_rank", ref++);
          });
      }
    },

    /**
     * Function used to remove the 'message' values that are duplicated in an array
     * @param {*} originalArray
     * @param {*} prop
     * @return {*} un nouveau tableau sans les éléments en double
     */
    removeDuplicates(originalArray, prop) {
      var newArray = [];
      var lookupObject = {};

      for (var i in originalArray) {
        lookupObject[originalArray[i][prop]] = originalArray[i];
      }

      for (i in lookupObject) {
        newArray.push(lookupObject[i]);
      }
      //console.log(newArray);
      //console.log(lookupObject);
      return newArray;
    },
    /**
     * Function that builds an object with a label and the list of elements to display in the list of the corresponding checkbox
     *
     * @param {Array} list_to_fill //le tableau à remplir
     * @param {Array} list //Le tableau contenant les infos récupérées dans le JSON
     * @param {Int} ref //le numéro de référence de la liste
     * @param {String} label //Le label de l'objet retourné
     * @return {Object} un objet avec label, ref et liste des objets 
     */
    fill_menu_list(list_to_fill, list, label, ref) {
      //Construction de chaque objet et ajout au tableau
      let i = 0; //Variable qui sert à avoir un id qui s'incrémente
      for (const el in list) {
        let tab = {};
        tab["id"] = i++;
        tab["message"] = list[el];
        tab["ref"] = ref;
        list_to_fill.push(tab);
      };

      //Construction de l'objet résultat qu'on va renvoyer
      let res = {
        label: label,
        list: this.removeDuplicates(list_to_fill, "message"), //On met la liste dans l'objet en supprimant les doublons avant
        ref: ref
      };

      return res;
    },
    /**
     * Function that gets the value of a given field in an array
     * @param {*} input
     * @param {*} field
     * @return {*} un tableau avec les clé trouvés
     */
    getFields(input, field) {
      let output = [];
      for (let i = 0; i < input.length; ++i) {
        output.push(input[i][field]);
      };
      return output;
    },
    /**
     * Function used to fetch a defined node from an tree (like a JSON)
     *
     * @param {*} obj
     * @param {*} prop
     * @return {*} un objet
     */
    fetchFromObject(obj, prop) {
      if (typeof obj === "undefined") {
        return false;
      }

      var _index = prop.indexOf(".");
      if (_index > -1) {
        return this.fetchFromObject(
          obj[prop.substring(0, _index)],
          prop.substr(_index + 1)
        );
      }
      return obj[prop];
    },
  },
});
