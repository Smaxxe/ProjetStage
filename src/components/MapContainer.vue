<template>
  <div v-if="dataIsSet">
    <button v-if="allLoc.bornes[0] !== undefined" class="btn btn-primary" @click="showBirthOrLastPlace(0)"
      :disabled="animationRunning">Show birth
      place</button>
    <button v-if="allLoc.bornes[1] !== undefined" class="btn btn-primary" @click="showBirthOrLastPlace(1)"
      :disabled="animationRunning">Show last
      residence</button>
    <button class="btn btn-primary" @click="animateTrajectory('residential')" :disabled="animationRunning">Animate
      residential trajectory</button>
    <button class="btn btn-primary" @click="animateTrajectory('professional')" :disabled="animationRunning">Animate
      professional trajectory</button>
    <button class="btn btn-primary" @click="toggleLines('residential')" :disabled="animationRunning">Toggle residential
      trajectory</button>
    <button class="btn btn-primary" @click="toggleLines('professional')" :disabled="animationRunning">Toggle
      professional trajectory</button>
  </div>
  <div ref="map-root" style="width: 100%; height: 100%">
    <div ref="popup" class="ol-popup">
      <PopupElement v-for="episode in popupContent" :key="episode.id" :id="episode.id" :traj="episode.traj"
        :message="episode.message" :rang="episode.rang" :clickRank="nextPrevTargetRank" :clickTraj="nextPrevTargetTraj"
        :dateBeg="episode.dateBeg" :dateEnd="episode.dateEnd" @nextLine="displayNextPrevLine"
        @previousLine="displayNextPrevLine">
      </PopupElement>
    </div>
  </div>

</template>

<script>
import PopupElement from './PopupElement.vue'
import pinia from "@/store.js";
import { useDataStore } from "../stores/DataStore";
const myUseStore = useDataStore(pinia);

import { transform } from "ol/proj.js";
import View from "ol/View";
import Map from "ol/Map";
import Feature from "ol/Feature";
import { Cluster, OSM, Vector as VectorSource } from 'ol/source';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import AnimatedCluster from 'ol/layer/Vector';
import { LineString, Point } from "ol/geom";
import { Circle, Fill, Icon, Stroke, Style, Text } from 'ol/style';
import Overlay from "ol/Overlay";
import Control from 'ol/control/Control';

const arrowColor = {
  residential: '#33691e',
  professional: '#0663af'
}
//Definition of all the styles used for the different trajectories
const styles = {
  //Style qu'on va appliquer aux éléments résidentiels (en vert)
  residential: new Style({
    image: new Circle({ //Instanciation d'un point
      fill: new Fill({ //Le remplissage de l'intérieur du point, 0.5 => opacité
        color: 'rgba(51, 105, 30)'
      }),
      stroke: new Stroke({ //Le contour du point, l'opacité est de 1
        color: 'rgba(51, 105, 30)',
        width: 2.5
      }),
      radius: 8, //La taille du point
    }),
    stroke: new Stroke({
      color: '#33691e',
      width: 4
    }),
  }),

  //Style des éléments familiaux (en rose)
  familial: new Style({
    image: new Circle({ //Instanciation d'un point
      fill: new Fill({ //Le remplissage de l'intérieur du point
        color: 'rgba(255, 153, 255)'
      }),
      stroke: new Stroke({ //Le contour du point, l'opacité est de 1
        color: 'rgba(255, 153, 255)',
        width: 2.5
      }),
      radius: 8, //La taille du point
    }),
    fill: new Fill({
      color: 'rgba(255, 23, 68)'
    }),
    stroke: new Stroke({
      color: 'rgba(255, 23, 68)',
      width: 2.5
    }),
  }),

  //Style des éléments pros (en bleu)
  professional: new Style({
    image: new Circle({ //Instanciation d'un point
      fill: new Fill({ //Le remplissage de l'intérieur du point, 0.5 => opacité
        color: '#0663af'
      }),
      stroke: new Stroke({ //Le contour du point, l'opacité est de 1
        color: '#0663af',
        width: 2.5
      }),
      radius: 8, //La taille du point
    }),
    fill: new Fill({
      color: '#0663af'
    }),
    stroke: new Stroke({
      color: '#0663af',
      width: 3
    }),
  }),

  //Style des éléments de loisirs (en jaune)
  leisure: new Style({
    image: new Circle({ //Instanciation d'un point
      fill: new Fill({ //Le remplissage de l'intérieur du point, 0.5 => opacité
        color: 'rgba(255, 241, 118, 0.5)'
      }),
      stroke: new Stroke({ //Le contour du point, l'opacité est de 1
        color: 'rgba(255, 241, 118)',
        width: 2.5
      }),
      radius: 8, //La taille du point
    }),
    fill: new Fill({
      color: 'rgba(249, 168, 37 0.5)'
    }),
    stroke: new Stroke({
      color: 'rgba(249, 168, 37)',
      width: 2.5
    }),
  })
};

export default {
  data() {
    return {
      map: Object,
      popupContent: [], //Variable qui va contenir le texte d'un popup quand on en affiche un
      //On stocke nos layers pour pouvoir les enlever ou les ajouter facilement
      residentialLinesLayer: Object,
      professionalLinesLayer: Object,
      nextPrevTargetRank: String, //Var permettant de passer aux composants de la popup le rang de l'épisode demandé par l'user quand il clique sur next/prev pour afficher cet épisode en + visible
      nextPrevTargetTraj: String, //Pareil pour la trajectoire, pour être sûrs d'afficher l'épisode de la bonne trajectoire
      dataIsSet: false, //Le booléen qui sert à afficher ou non certains boutons tant qu'on a pas une recherche,
      animationRunning: false, //Booléan qui va permettre de bloquer les boutons d'animation quand une est en cours
    }
  },
  components: {
    PopupElement
  },
  computed: {
    /**
     * Variable that builds an object containing all the locations of the person : dots for episodes, lines for events and bornes for the birth and last living place
     * Automatically updated whend the data in the store changes
     */
    allLoc() {
      //Object that will be returned
      let coords = {
        points: [], //Episodes, only on array for the clusters
        //Birth and last living place, initialized with undefined for checking if it has been replaced or not later
        bornes: [undefined, undefined],
        lignes: { //Events, on array per trajectory to apply differente styles
          residential: [],
          professional: [],
        }
      };

      if (myUseStore.info !== {}) {
        let rawData = myUseStore.info;

        //Going through the JSON to the leaves to get the data
        for (const trajectory in rawData) { //Parcours du premier niveau du JSON, les 4 trajectoires

          for (const type in rawData[trajectory]) { //Parcours du 2e niveau, les catégories events/episodes

            for (const el in rawData[trajectory][type]) { //Parcours des feuilles avec traitement

              let feuille = rawData[trajectory][type][el]; //The current leaf to process

              //No process for familia episodes bc thay do not have a loc
              if (trajectory !== 'familial' || type !== 'episode') {
                if (feuille.longitude !== -1 && feuille.latitude !== -1) {
                  let point = [feuille.longitude, feuille.latitude]; //The dot coords

                  //When it is an episode, we create a feature containing the coords + data
                  //We also take familai events that have a loc and the pro events that reoresent studies
                  if (type === 'episode' || (trajectory === 'familial' && type !== 'episode') || (trajectory === 'professional' && type === 'event' && feuille.type_event.trim() === 'Studies')) {
                    //And the relatives of the person are processed differently
                    if (type !== 'children' && type !== 'partner' && type !== 'parents') {
                      let feature = new Feature({
                        name: trajectory,
                        geometry: new Point(point).transform("EPSG:4326", "EPSG:3857"),
                        //Le code html du popup à afficher quand on clique sur le point
                        popup: this.createHTMLSinglePopup(trajectory, type, feuille),
                        rang: feuille.rang,
                        //On passe la date pour pouvoir trier dans l'ordre chronologique
                        dateBeg: (type === 'event') ? feuille.annee : feuille.date_debut,
                        dateEnd: (type === 'event') ? feuille.annee : feuille.date_fin
                      });

                      coords.points.push(feature); //Ajout de la nouvelle feature à notre tableau

                    } else { //Ici on est dans les episodes familiaux concernant les proches
                      //TODO: gérer les points concernant les proches
                    }
                  } else if (type !== 'children' && type !== 'partner' && type !== 'parents') {
                    //Events (not familial), they represent the arrows

                    //We check the trajectory to put the data in the corresponding array

                    if (trajectory === 'residential' && type === 'event' && feuille.type_event.trim() !== 'Pension' && feuille.type_event.trim() !== 'Birth') { //Res event without 'Pension'

                      ///Building an object with the data of the event
                      let ligne = {
                        point: point,
                        rang: feuille.rang.trim(),
                        date: feuille.annee.trim(),
                        popup: this.createHTMLSinglePopup(trajectory, type, feuille),
                        city: feuille.commune.trim(),
                        department: feuille.departement.trim()
                      };

                      coords.lignes.residential.push(ligne);
                    } else if (trajectory === 'professional' || (type === 'event' && feuille.type_event.trim() !== 'Studies' && feuille.type_event.trim() !== 'Travel' && feuille.type_event.trim() !== 'Birth' && feuille.type_event.trim() !== 'Pension')) { //Pro event without 'Studies'
                      let ligne = {
                        point: point,
                        rang: feuille.rang.trim(),
                        date: feuille.annee.trim(),
                        popup: this.createHTMLSinglePopup(trajectory, type, feuille),
                        city: feuille.commune.trim(),
                        department: feuille.departement.trim()
                      };

                      coords.lignes.professional.push(ligne);
                    };
                  };

                  //Ici on veut accéder au lieu de naissance et au dernier lieu d'habitation. 
                  //Le lieu de naissance est quand l'event est "Birth", 
                  //et le dernier lieu d'habitation est le lieu résidential où rank = myUseStore.menu_residential_rank[length-1] (le dernier rank)

                  if (type === 'event' && feuille.type_event.trim() === 'Birth') { //Birth place
                    let feature = new Feature({
                      name: 'lieuNaissance',
                      geometry: new Point(point).transform("EPSG:4326", "EPSG:3857")
                    });

                    coords.bornes[0] = feature; //Replacing the undefined
                  };

                  //Going through residential episodes to find the last one
                  if (trajectory === 'residential' && type === 'episode') {
                    //We get that last element of the resi events that ar in the store
                    let objDerResi = myUseStore.menu_residential_rank.list[(myUseStore.menu_residential_rank.list.length) - 1];
                    let maxResiRank = objDerResi['message'];

                    if (feuille.rang === maxResiRank) { //Si on est dans la feuille contenant le dernier lieu
                      let feature = new Feature({ //Creation of a feature
                        name: 'derResi',
                        geometry: new Point(point).transform("EPSG:4326", "EPSG:3857")
                      });

                      coords.bornes[1] = feature; //Replacing the 2nd undefined
                    };
                  };
                };
              };
            };
          };
        };
      };
      return coords; //On renvoie le tableau contenant tous les points
    },
  },
  mounted() {
    // this is where we create the OpenLayers map
    this.map = new Map({
      // the map will be created using the 'map-root' ref
      target: this.$refs["map-root"],
      layers: [
        // adding a background tiled layer
        new TileLayer({
          name: 'base',
          source: new OSM(), // tiles are served by OpenStreetMap
        }),
      ],
      overlays: [],
      //Fixing the center and the initial zoom level
      view: new View({
        zoom: 5.5,
        center: transform([2.66942188, 46.7132645], "EPSG:4326", "EPSG:3857"),
        constrainResolution: true,
      }),
    })
  },

  watch: {
    allLoc() { //When the locations are updated, we generate the elements
      const map = this.map;
      this.dataIsSet = true;

      this.removeAllLayers(map); //Suppression des layers de l'individu d'avant

      this.createLines(map); //Création des lignes

      this.placeIconsStartAndEnd(map); //Ajout des points naissance et fin étude

      this.createClusters(map);//Ici, on instancie les clusters et leur réactivité
    },
  },

  methods: {
    /**
     * Function that removes all the layers of the map other than the map itself
     */
    removeAllLayers(map) {
      let layerSupp = []; //Array to put the layers that will be removed

      //We check all the layers to get those that are not the base of the map
      map.getLayers().forEach(layer => {
        if (layer && layer.get('name') !== 'base') {
          layerSupp.push(layer); //We put them in our array
        };
      });

      layerSupp.forEach(layer => { //We remove them all
        map.removeLayer(layer);
      });
    },

    /**
     * Function that creates 2 icons and places them at the birth place and the last living place
     */
    placeIconsStartAndEnd(map) {
      if (this.allLoc.bornes[0] !== undefined) { //If we do not have data on birth place, no point creation
        let borneDébutLayer = new VectorLayer({
          name: 'borneNaiss',
          source: new VectorSource({
            features: [this.allLoc.bornes[0]]
          }),
          style: new Style({
            image: new Icon({ //Création de l'icone qui va s'afficher sur ce point
              anchorOrigin: 'top-left',
              anchor: [0.5, 1.3],
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              src: 'src/assets/images/logo-naiss.png',
              scale: 0.06,
            })
          })
        });

        map.addLayer(borneDébutLayer); //Adding the birth place icon layer

      };

      if (this.allLoc.bornes[1] !== undefined) { //Same process here for the last living place
        let borneFinLayer = new VectorLayer({ //Dernier lieu d'habitation
          name: 'borneFin',
          source: new VectorSource({
            features: [this.allLoc.bornes[1]]
          }),
          style: new Style({
            image: new Icon({ //Création de l'icone qui va s'afficher sur ce point
              anchorOrigin: 'top-left',
              anchor: [0.5, 1.3],
              anchorXUnits: 'fraction',
              anchorYUnits: 'fraction',
              src: 'src/assets/images/last-home.png',
              scale: 0.06,
            })
          })
        });

        map.addLayer(borneFinLayer); //Ajout du layer de l'icone du dernier lieu de vie

      };
    },

    /**
     * Function that creates the clusters of dots and their reaction when clicking on it
     */
    createClusters(map) {
      //Construction du vecteur avec toutes nos features (nos points) en passant le tableau en param
      let source = new VectorSource({
        features: this.allLoc.points
      });

      //Construction du cluster à partir du vecteur contenant les points
      let clusterSource = new Cluster({
        distance: 0, //La distance de formation des cluster est zéro pour n'avoir sous forme de clusters que les points qui possèdent exactement les mêmes coordonnées
        source: source
      });

      let styleCache = {}; //le cache de styles pour éviter de recréer un style s'il existe déjà

      //Ici on a la création concrète du layer contenant les points qui peuvent être clusterisés
      let clusters = new AnimatedCluster({
        name: 'cluster', //Son nom
        source: clusterSource, //Son contenu : le cluster créé plus haut
        animationDuration: 700,
        //Et le style appliqué, qui est ici une fonction qui construit le style de chaque point dynamiquement
        style: function (feature) {
          let size = feature.get('features').length;
          let style = styleCache[size]; //On tente de récupérer le style correspondant au nb de points s'il existe déjà dans le tableau de styles

          if (size > 1) { //On va appliquer le style "cluster" seulement si on a plusieurs points
            if (!style) { //Si le style correspondant à la taille demandée n'existe pas, on en crée un nouveau
              style = new Style({ //Instanciation du style openlayers
                image: new Circle({ //Création des cercles
                  radius: 9,
                  stroke: new Stroke({
                    color: '#fff'
                  }),
                  fill: new Fill({
                    color: '#0f0f0f'
                  }),
                }),
                text: new Text({ //Création du texte affiché sur les cercles : le nb de points présents
                  text: size.toString(),
                  fill: new Fill({
                    color: '#fff'
                  }),
                }),
              });

              styleCache[size] = style; //On ajoute le nouveau style au cache pour le réutiliser si besoin
            }
            return style; //On renvoie le style pour l'appliquer au cluster courant

          } else { //Quand on a un seul point, on affiche directement le style de l'épisode correspondant
            let point = feature.get('features'); //Récupération du contenu du point
            let name = point[0]['values_']['name']; //On récupère le nom associé à notre point
            let style = [styles[name]];

            //On ajoute au style le chiffre 1 pour indiquer 1 seul episode
            style.push(new Style({
              text: new Text({
                text: '1',
                fill: new Fill({
                  color: '#fff'
                }),
              }),
            }))

            return style; //On renvoie le style qui correspond au nom
          };
        },
      });

      map.addLayer(clusters); //On ajoute effectivement le layer clusters créé à notre carte

      //Ajout d'un overlay 'popup' quand on clique sur une feature (un point)
      map.on('singleclick', event => {
        this.displayPopup(event);
      });

      //Suppression des overlays quand on clique ailleurs (ici ça supprime le seul ouvert donc le popup)
      map.on(['click'], event => {
        this.map.getOverlays().forEach(overlay => {
          this.map.removeOverlay(overlay);
        })
      })
    },

    /**
     * Function that creates and display a popup containing the dot data
     * 
     * @param {Object} event contient les infos de l'évènement créé par le clic
     */
    displayPopup(event) {
      const map = this.map;
      let element = map.forEachFeatureAtPixel(event.pixel, feature => {

        if (feature.getGeometry().getType() === 'Point') {
          return feature
        };
      });
      let coordinate;
      if (element !== undefined) { //Pour éviter les erreurs quand on clique sur rien
        if (element.getGeometry().getType() === 'Point') { //Quand on clique sur un point

          let features = element['values_']['features']; //Récupération des features

          let firstFeature = features[0]; //Récupération de la première feature (potentiellement la seule)

          //Récupération des coordonnées de la/des feature, de son contenu à afficher
          coordinate = firstFeature.getGeometry().getCoordinates();
          this.popupContent = this.assembleHTMLPopups(features);
        } else { //Quand on clique sur une ligne
        }

        //Création d'un overlay à l'endroit de la feature
        let overlay = new Overlay({
          position: coordinate,
          element: this.$refs['popup'], //Référence à l'élement html qui va l'afficher
        });

        map.addOverlay(overlay); //On ajoute concrètement l'overlay à la map
      };
    },

    /** Function that creates a popup for a simple episode
     * 
     * @param {String} trajectory trajectory in which the function is called
     * @param {String} type event or episode
     * @param {Object} feuille the data to process
     * @returns the popup html content
     */
    createHTMLSinglePopup(trajectory, type, feuille) {
      let res = '';
      trajectory = trajectory[0].toUpperCase() + trajectory.substring(1); //Ajout majuscule

      if (type === 'episode') {
        //In an episode there is a ending date and a beggining date
        res = '<ul>' +
          '<li><b>From </b>: ' + feuille.date_debut.trim() + '</li>' +
          '<li><b>To </b>: ' + feuille.date_fin.trim() + '</li>' +
          '<li><b>Episode </b>: ' + feuille.type_episode.trim() + '</li>' +
          '<li><b>Department </b>: ' + feuille.departement + '</li>' +
          '<li><b>City </b>: ' + feuille.commune.trim() + '</li>' +
          '</ul>';
      } else {
        //For an event it is only a specific date
        res = '<ul>' +
          '<li><b>Rank </b>: ' + feuille.rang.trim() + '</li>' +
          '<li><b>Year </b>: ' + feuille.annee.trim() + '</li>' +
          '<li><b>Event </b>: ' + feuille.type_event.trim() + '</li>'
        '<li><b>Department </b>: ' + feuille.departement + '</li>' +
          '<li><b>City </b>: ' + feuille.commune.trim() + '</li>' +
          '</ul>';
      }

      return res;
    },

    /**
     * Function that returns an array containing objects used to instanciate a component
     * All the components created are displayed in the popup of a cluster dot
     * 
     * @param {*} features all the features get in the clicked cluster
     */
    assembleHTMLPopups(features) {
      let res = []; //Résultat à renvoyer

      //Sorting of the array to go through without problems of chronology
      features.sort(function (a, b) {
        return parseInt(a['values_']['dateBeg'], 10) - parseInt(b['values_']['dateBeg'], 10);
      });

      //Adding each element one after another
      features.forEach((feature, index) => {
        let episode = {
          id: index,
          traj: feature['values_']['name'],
          message: feature['values_']['popup'],
          rang: parseInt(feature['values_']['rang'], 10),
          dateBeg: feature['values_']['dateBeg'],
          dateEnd: feature['values_']['dateEnd'],
        };

        res.push(episode);
      });
      return (res);
    },

    /**
     * Function that creates all the arrows 
     */
    createLines(map) {
      for (let lineTab in this.allLoc.lignes) {
        let currentTab = this.allLoc.lignes[lineTab]; //Stockage du tableau à traiter

        if (currentTab.length !== 0) {

          let startPoint = currentTab[0].point; //Stockage du point de départ
          let allLines = []; //Le tableau qu'on va remplir avec les features lignes

          currentTab.forEach((ligne) => { //Parcours du tableau courant

            let endPoint = ligne.point; //Stockage du point d'arrivée de la ligne en cours

            let line = new Feature({ //Création de la ligne avec point de départ et d'arrivée
              geometry: new LineString([startPoint, endPoint]),
              rang: ligne.rang,
              date: ligne.date,
              popup: ligne.popup,
              city: ligne.city,
              department: ligne.department
            });

            line.getGeometry().transform("EPSG:4326", "EPSG:3857"); //Formatage des données lignes

            allLines.push(line); //Ajout de cette ligne à notre tableau de lignes

            startPoint = endPoint; //Passage au point de départ de la ligne suivante
          });

          let currentStyle = styles[lineTab]; //On récupère le style qu'il va falloir appliquer

          let layer = new VectorLayer({ //Création du layer avec toutes les lignes de cette traj
            name: `${lineTab}` + "_lines",
            source: new VectorSource({
              features: allLines
            }),
            style: (feature) => {
              const geometry = feature.getGeometry();
              const style = [currentStyle]; //Récupération du style selon le nom

              //Parcours de tous les segments pour ajouter les flèches
              geometry.forEachSegment((start, end) => {
                let currentArrowColor = arrowColor[lineTab]; //Couleur de la flèche

                //On ne met une flèche que si la ligne a un point d'arrivée différent
                if (!this.arraysEquals(start, end)) { //du point de départ

                  //Calcul de l'orientation de la flèche
                  const dx = end[0] - start[0];
                  const dy = end[1] - start[1];
                  const rotation = Math.atan2(dy, dx);
                  //Ajout de la flèche
                  style.push(
                    new Style({
                      geometry: new Point(end),
                      image: new Icon({
                        src: 'src/assets/images/arrow.png',
                        anchor: [1.4, 0.5],
                        rotateWithView: true,
                        rotation: -rotation, //On appplique la rotation
                        scale: 1.3,
                        color: currentArrowColor //On applique la bonne couleur
                      }),
                    })
                  );
                };
              });

              return style;
            }
          });
          this[`${lineTab}` + 'LinesLayer'] = layer; //On stocke le layer pour le remettre facilement si besoin
          map.addLayer(layer);
        };
      };
    },

    /** 
     * Gets data from an event sens by a PopupElement, and displays the line going to the next episode in the trajectory (with a layer added containing a red arrow)
     * 
     * @param {Object} payload data sent by the event
     */
    displayNextPrevLine(payload) {
      const map = this.map;
      let traj = payload.traj; //Stockage des infos envoyée par le composant
      let rang = payload.next === true ? parseInt(payload.rang, 10) + 1 : parseInt(payload.rang, 10) + 1;
      let layerName = traj + '_lines'; //Le nom qu'on va chercher dans les layers existants

      //Récupération du layer contenant les lignes de la trajectoire dont on veut l'élément suivant
      let targetLayer = map.getLayers().getArray().find(layer => layer.get('name') === layerName);

      if (targetLayer.getVisible()) {

        //Récupération de toutes les lignes du layer
        let features = targetLayer.getSource().getFeatures();

        //On va trier le tableau dans l'ordre des rangs pour faciliter le traitement qui suit
        features.sort((a, b) => {
          let rangA = parseInt(a['values_']['rang'], 10);
          let rangB = parseInt(b['values_']['rang'], 10);

          return rangA - rangB;
        });

        //Ici on va chercher à récupérer la feature (ligne) dont le rang est le plus proche supérieur au rang de l'épisode sur lequel on vient de cliquer
        let targetLine;
        features.every((feature) => { //On parcourt le tableau de features
          let currentRang = parseInt(feature['values_']['rang'], 10); //On récupère le rang courant

          if (currentRang >= rang) { //Le tableau étant trié, on retourne la feature dès qu'elle est au moins égale au rang de l'épisode
            targetLine = feature;
            return false;
          };

          return true; //On continue tant qu'on est pas entrés dans le if
        });

        //A ce stade, si targetLine est undefined, c'est qu'on est en bout de lignes et que le rang cherché est supérieur à tous les rangs existants dans le tableau
        if (targetLine === undefined) {
          targetLine = features[features.length - 1]; //Donc la ligne qu'on cherche est la toute dernière
        };

        if (payload.next !== true) { //Si on veut la ligne précédente, on va simplement prendre l'élément juste avant celui qu'on a récupéré au-dessus
          let index = features.indexOf(targetLine); //Récup de l'indice de l'élément trouvé
          targetLine = features[index - 1]; //Finalement on prend celui en-dessous
        };

        //Une fois qu'on a la ligne, on récupère son rang pour le passer aux composants du popup
        //Si on veut l'épisode précédent, on prend un rang en-dessous 
        payload.next === true ? this.nextPrevTargetRank = targetLine['values_']['rang'] : this.nextPrevTargetRank = (parseInt(targetLine['values_']['rang'], 10) - 1).toString();

        this.nextPrevTargetTraj = traj; //On fait aussi passer la traj pour ne pas changer le style de plusieurs trajectoires

        let coordinates = targetLine.getGeometry().getCoordinates(); //Récup des coordonnées de la ligne
        //Récupération des points de départ et d'arrivée de la ligne
        let start = coordinates[0];
        let end = coordinates[1];

        //Removing the red arrow created before (and thos of the other traj if there are)
        this.map.removeLayer(this.map.getLayers().getArray().find(layer => layer.get('name').includes('nextLine')));
        let name = 'nextLine' + traj; //Le nom qu'on va donner au layer créé en dessous
        this.createArrow(start, end, traj, 'red', name); //Appel de la fonction de création de la ligne rouge

        //On récupère le point visé pour déplacer la vue
        let aim = payload.next === true ? end : start
        //let pixel = map.getPixelFromCoordinate(aim); //On récupère le pixel de ce point
        //Permet de déplacer directement la carte sur point suivant
        map.getView().animate({
          center: aim,
          duration: 2000
        }, () => { //Callback to display the popup after the movement
          setTimeout(() => { //Timeout to let the map load components before getting pixel
            let coord = map.getView().getCenter(); //Getting center of map
            let pixel = map.getPixelFromCoordinate(coord); //Getting pixel at the center
            let event = { pixel: pixel }; //Simulating an event
            this.displayPopup(event); //Calling the function with the event
          }, 300)
        });
      }
    },

    /**
     * Function used to display/hide a specific line layer and its red arrow if there is one
     * 
     * @param {String} traj the trajectory of the aimed layer
     */
    toggleLines(traj) {
      //Récupération du layer qu'on veut enlever + la flèche rouge indiquant le suivant/préc
      let targetLayer = this.map.getLayers().getArray().find(layer => layer.get('name') === traj + '_lines');
      let redArrowLayer = this.map.getLayers().getArray().find(layer => layer.get('name') === 'nextLine' + traj);

      if (targetLayer !== undefined) {
        if (targetLayer.getVisible() === false) { //Si le layer est caché, on le rend visible
          targetLayer.setVisible(true);
        } else { //S'il est présent, on l'enlève
          targetLayer.setVisible(false);
        };
      };

      if (redArrowLayer !== undefined && redArrowLayer.getVisible() === true) { //S'il y a une flèche rouge concernant cette traj
        redArrowLayer.setVisible(false);
      };
    },

    /**
     * Function that focuses the map on the last living place
     */
    showBirthOrLastPlace(numborne) {
      //Getting the loc of the element we want to focus on
      let point = this.allLoc.bornes[numborne].getGeometry().getCoordinates();
      let view = this.map.getView();

      view.animate({ //Method that animates a movement
        center: point, //The point to focus on
        zoom: 10 //We can zoom or unzoom
      });
    },

    /**
     * Function launched when the user clicks on the button 'animate trajectory'
     * Launches and animation that goes trhough all the events of this traj
     * 
     * @param {*} traj the trajectory to animate
     */
    animateTrajectory(traj) {
      this.animationRunning = true; //Animation launched, buttons are disabled
      //Getting the line layer we want
      let targetLayer = this.map.getLayers().getArray().find(layer => layer.get('name') === traj + '_lines');

      if (targetLayer !== undefined) { //The animation launches only if the layer exists
        let features = targetLayer.getSource().getFeatures(); //Getting the features of the layer

        //We hide the lines of the traj
        targetLayer.setVisible(false);

        //We gat the name of the other traj present and the corresponding layer
        let otherLayer = traj === 'residential' ? 'professional' : 'residential';
        let secondLayer = this.map.getLayers().getArray().find(layer => layer.get('name') === otherLayer + '_lines');

        //If this second layer exists, we hide it too
        if (otherLayer !== undefined) {
          secondLayer.setVisible(false);
        }

        let globalElement = document.createElement('div');
        //DOM element that will be filled with data from the animation
        let element = document.createElement('div');
        globalElement.className = "infoAnim";

        //Button that will close the infoAnim panel + delete lines
        let button = document.createElement('button');
        button.style.visibility = "hidden";
        button.innerText = 'X';
        button.className = 'btn btn-primary'

        //Event when the user clicks on the button 'x' : it deletes the created lines of the animation
        //And shows back the lines before
        button.addEventListener('click', () => {
          globalElement.remove();
          let layerSupp = []; //Tableau qu'on va remplir avec les layers à retirer

          //Going through all layers and stocking the ones that are created during the animation
          this.map.getLayers().forEach(layer => {
            if (layer && layer.get('name') === name) {
              layerSupp.push(layer);
            };
          });

          layerSupp.forEach(layer => { //We delete them all 
            this.map.removeLayer(layer);
          });

          this.toggleLines('residential');
          this.toggleLines('professional');
        });

        //Little info that appears only when the animation is ended
        let animEnd = document.createElement('div');
        animEnd.innerHTML = '<b>Animation over</b>';
        animEnd.className = 'animEnd';
        animEnd.style.visibility = 'hidden';

        //Adding all the elements : button and divs with text
        globalElement.appendChild(button);
        globalElement.appendChild(element);
        globalElement.appendChild(animEnd);

        //Creating a Control : a openlayers class used to create buttons or info panels
        let infoAnim = new Control({ element: globalElement, name: 'infoAnim' });

        this.map.addControl(infoAnim); //Adding the control element
        // this.map.addControl(closeButton);

        let lineColor = arrowColor[traj]; //La couleur des lignes qu'on ajoute
        let name = 'animatedLines'; //Le nom des lignes qu'on va ajouter au fur et à mesure
        let redName = 'nextLine' + traj; //Le nom de la ligne rouge qu'on va changer à chaque fois

        //Rangement du tableau de features dans l'ordre des rangs pour pouvoir le parcourir dans l'ordre
        features.sort((a, b) => {
          let rangA = parseInt(a['values_']['rang'], 10);
          let rangB = parseInt(b['values_']['rang'], 10);

          return rangA - rangB;
        });

        let noData = []; //Array to stock the events where we have no data
        let rangCourant;

        //Creation of a promise to be sure to wait the end of forEach before executing the rest
        let promise = new Promise((resolve, reject) => {
          //Going through all features with a timeout of a few seconds to have time to get what is happening
          features.forEach((feature, i, features) => {
            setTimeout(() => {
              //Getting the start and the end of the current line
              let coords = feature.getGeometry().getCoordinates();
              let start = coords[0];
              let end = coords[1];
              rangCourant = feature['values_']['rang'];

              //Removing the last red arrow
              this.map.removeLayer(this.map.getLayers().getArray().find(layer => layer.get('name') === 'nextLine' + traj));
              //We add a green arrow to show the whole traj stpe by step (removed at the end)
              this.createArrow(start, end, traj, lineColor, name);
              //And a red arrow to show the event currently watched
              this.createArrow(start, end, traj, 'red', redName);

              element.innerHTML = '<h4>' + traj[0].toUpperCase() + traj.substring(1) + '</h4>' +
                '<h6> Event n°' + rangCourant + '</h6>'
                + '<b> Date : </b>' + feature['values_']['date'] + '<br>'
                + ' <b> City : </b> ' + feature['values_']['city'] + '<br>'
                + '<b>  Department : </b> ' + feature['values_']['department'] + '<br>'
                + '<p> <b>Events number with no spatial data : </b>' + noData.toString() + '</p>';

              //On va récupérer le point d'arrivée qui précède pour regarder si c'est le même que le courant
              let previousEnd = [];
              if (i !== 0) { //Pour ne pas aller chercher l'élément à i = -1
                previousEnd = features[i - 1].getGeometry().getCoordinates()[1];
              }
              //Et on ne demande l'animation que dans le cas où ces deux points sont différents
              if (!this.arraysEquals(end, previousEnd)) {

                //For an animation with unzoom/zoom
                //this.flyTo(end, 10, function () { }); //On se déplace vers le point suivant

                //For an animation with straight moving
                let view = this.map.getView();
                view.animate({
                  center: end,
                  duration: 1500,
                  zoom: 11
                })
              };

              //Vérification pour d'éventuels trous dans les épisodes
              let rangSuiv;
              if (i !== features.length - 1) {
                rangSuiv = parseInt(features[i + 1]['values_']['rang'], 10); //Récup rang d'après
              };

              while (rangSuiv - rangCourant > 1) {
                rangCourant = parseInt(rangCourant, 10) + 1;
                noData.push(rangCourant);
              };

              if (i === features.length - 1) resolve(); //If it is the end of array, the promise is resolved
            }, i * 3000); //A timeout to wait a bit before moving
          });
        });

        //Once the animation is ended, we toggle back the lines and remove our created lines
        promise.then(() => {
          button.style.visibility = 'visible'; //Button to close is set visible
          animEnd.style.visibility = 'visible';
          this.animationRunning = false; //To reactivate the buttons
        });
      };
    },

    /**
     * 
     * Function that creates an arrow between two points and with a given color
     * 
     * @param {} start le point de départ de la flèche
     * @param {} end le point d'arrivée
     * @param {String} traj la trajectoire courante
     * @param color la couleur qu'on veut donner à la ligne et la flèche
     * @param name le nom qu'on veut donner au layer
     */
    createArrow(start, end, traj, color, name) {

      //Création d'un nouveau layer contenant une ligne à superposer à celle existante
      let nextLine = new Feature({
        geometry: new LineString([start, end])
      });

      let layerNextLine = new VectorLayer({
        name: name,
        source: new VectorSource({
          features: [nextLine]
        }),
        //Création d'un style qui rpz la même flèche mais en couleur différente
        style:
          (feature) => {
            const geometry = feature.getGeometry();
            const style = [new Style({
              stroke: new Stroke({
                color: color,
                width: 4
              })
            })];

            //Parcours de tous les segments pour ajouter les flèches
            geometry.forEachSegment(function (start, end) {
              //Calcul de l'orientation de la flèche
              const dx = end[0] - start[0];
              const dy = end[1] - start[1];
              const rotation = Math.atan2(dy, dx);
              //Ajout de la flèche
              style.push(
                new Style({
                  geometry: new Point(end),
                  image: new Icon({
                    src: 'src/assets/images/arrow.png',
                    anchor: [1.4, 0.5],
                    rotateWithView: true,
                    rotation: -rotation, //On appplique la rotation
                    scale: 1.3, //Changement de la taille de l'image
                    color: color
                  }),
                })
              );
            });

            return style;
          }
      });

      //Ajout de la ligne à superposer : l'indice 3 étant au-dessus des lignes mais en-dessous des points
      //this.map.getLayers().insertAt(3, layerNextLine);
      this.map.addLayer(layerNextLine);
    },

    /**
     * Comparison if 2 arrays, return true if thay are the same data in the same order
     */
    arraysEquals(a, b) {
      if (a.length !== b.length) {
        return false;
      }

      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        };
      };

      return true;
    },

    /**
     * Function that zooms/unzooms whil moving to a given location
     * Source : https://openlayers.org/en/latest/examples/animation.html
     */
    flyTo(location, zoom, done) {
      const view = this.map.getView();
      const duration = 3500;
      // const zoom = view.getZoom();
      let parts = 2;
      let called = false;

      function callback(complete) {
        --parts;
        if (called) {
          return;
        }
        if (parts === 0 || !complete) {
          called = true;
          done(complete);
        }
      }
      view.animate(
        {
          center: location,
          duration: duration,
        },
        callback
      );
      view.animate(
        {
          zoom: zoom - 1,
          duration: duration / 2,
        },
        {
          zoom: zoom,
          duration: duration / 2,
        },
        callback
      );
    },
  }
};
</script>

<style >
.ol-popup {
  position: absolute;
  background-color: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  padding: 0px;
  border-radius: 10px;
  border: 1px solid #cccccc;
  bottom: 12px;
  left: -50px;
  min-width: 250px;
  max-height: 250px;
  font-size: 75%;
  overflow-y: scroll;
}

.bloc-popup {
  border-top-color: black;
  border-width: 5px;
}

.btn {
  margin-left: 5px;
  font-size: 70%;
  width: 15%;
  padding: 2px;
}

.infoAnim {
  float: right;
  background-color: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 1px solid #cccccc;
  padding: 5px;
  max-width: 15%;
}

.infoAnim div {
  font-size: 1.8vh;
}

.infoAnim button {
  float: right;
}

.animEnd {
  font-size: bold;
  color: rgb(0, 159, 19);
}
</style>
