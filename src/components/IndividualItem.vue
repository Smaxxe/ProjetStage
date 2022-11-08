<script setup>
import Ligne from "./Ligne.vue";
import MapContainer from "./MapContainer.vue";
import axios from "axios";
import { ref, computed, reactive, watch } from "vue";

import CheckBoxItem from "./CheckBoxItem.vue";
import { useDataStore } from "../stores/DataStore";
import pinia from "@/store.js";
import { EMPTY_ARR } from "@vue/shared";

const myUseStore = useDataStore(pinia);

//The number entered by the user
const individualNumber = ref("");

const affMenu = ref(false); //Boolean used to display or not the whole menu
//Booleans used to hide/display the different filters of the menu
const affAll = ref(false);
const affTempo = ref(true);
const affSpatial = ref(true);
const affFamilial = ref(true);
const affResi = ref(true);
const affPro = ref(true);
const affLeisure = ref(true);

const mapKey = ref(true); //Key given to the MapContainer and used to refresh the map if needed

//Variables used for the temporal filter
const year = ref("");
const period_first = ref();
const period_second = ref();

//Variables used to display errors and disable other inputs when one is used 
const idInvalide = ref(false); //When the id is invalid

const anneeInvalide = ref(false); //When the year is invalid
const choixAnnee = ref(false); //When the user wants to enter a precise year

const choixPeriode = ref(false); //When the user wants to enter a period
const periodeInverse = ref(false); //When the period dates are reversed (min > max)

/**
 * Watcher on the id entered by the user : displays an error message until the id is valid + only sends the id to the store if it is valid
 */
watch(individualNumber, function callback(newId, oldId) {
  if (newId.length >= 1) { //Quand l'user commence à entrer un nombre

    idInvalide.value = true; //On lui indique qu'il doit être entre 5000 et 9904

    if (newId >= 5000 && newId <= 9904) { //Si le nombre devient bon
      myUseStore.individual_number = newId; //On le stocke dans le store

      idInvalide.value = false; //Et on retire le message
    };
  } else {
    idInvalide.value = false; //Quand l'user efface tout, le message disparaît
  };
});

/**
 * Watcher on the year : used to disable the other input when one is used and to display error messages if the date is invalid
 */
watch(year, function callback(newYear, oldYear) {
  if (newYear.length >= 1) {
    //Tant que l'user entre quelque chose de non valide

    //On vient bloquer l'input des dates min et max
    choixAnnee.value = true;

    if (newYear > 1854 && newYear < 2000) {
      //Quand la date est valide pour les données
      //On place l'année dans les deux bornes pour n'avoir qu'une seule année sélectionnée dans le serveur
      myUseStore.dateMin = newYear;
      myUseStore.dateMax = newYear;

      anneeInvalide.value = false; //On enlève le message d'erreur
    }

    //Dans le cas où la date entrée juste avant était valide, et qu'elle est modifiée
    if (oldYear > 1854 && oldYear < 2000) {
      //On vient vider les bornes pour remettre à zéro la période
      myUseStore.dateMin = "";
      myUseStore.dateMax = "";

      anneeInvalide.value = true;
    }
  } else {
    //Quand il n'y a rien d'entré dans l'année, le choix de la période redevient possible
    choixAnnee.value = false;
  }
});

/**
 * Watcher on the period : disable the date only when used + error message when dates ar invalid or reversed
 */
watch([period_first, period_second], ([newPF, newPS], [oldPF, oldPS]) => {
  //Si l'user choisit d'entrer des dates dans la période, on entre ici
  if (newPF.length >= 1 || newPS.length >= 1) {
    //On bloque l'input de l'année
    choixPeriode.value = true;

    //Ici on vérifie que la borne supérieure n'est pas en dessous de la borne inférieure
    //Si c'est le cas, on affiche un message d'erreur
    if (parseInt(newPF, 10) > parseInt(newPS, 10)) {
      periodeInverse.value = true;
    } else {
      //La période est valide dans la logique
      periodeInverse.value = false;

      //Ici on va vérifier mtn que la période est valide dans ses valeurs
      if (newPF > 1854 && newPF < 2000 && newPS > 1854 && newPS < 2000) {
        //Quand les années sont bonnes, on les stocke dans le store
        myUseStore.dateMin = newPF;
        myUseStore.dateMax = newPS;

        anneeInvalide.value = false;
      }

      //Dans le cas où les années entrées juste avant étaient valide, et qu'elles sont modifiées
      if (oldPF > 1854 && oldPF < 2000 && oldPS > 1854 && oldPS < 2000) {
        //On vient vider les bornes pour remettre à zéro la période
        myUseStore.dateMin = "";
        myUseStore.dateMax = "";
      }
    }
  } else {
    choixPeriode.value = false;
    periodeInverse.value = false;
  }
});

// /**
//  *  Testing function : asks the server for all the number to check if no errors
//  */
// function testServer() {
//   for (let i = 5000; i <= 9904; i++) {
//     axios.get("http://localhost:8000/data/" + i);
//   }
// }
</script>

<template>
  <main id="container">
    <div class="mb-3">
      <h3 class="">Enter a number between 5000 and 9904</h3>
      <input v-model="individualNumber" id="fillButton" type="text" placeholder="Individual number" aria-label="Search"
        @keyup.enter="myUseStore.getData()" @focus="idInvalide = true" @blur="idInvalide = false" />
      <button id="requestButton" class=" requestButton"
        @click="myUseStore.getData(); affAll = !affAll; mapKey = !mapKey" :disabled="idInvalide">Search</button>
      <button id="displayMenuButton" class=" requestButton" @click="affMenu = !affMenu ; mapKey = !mapKey">
        {{ affMenu ? "Hide request tool" : "Show request tool" }}
      </button>
      <div v-if="idInvalide" class="info validation">The input must be a number between 5000 and 9904</div>
    </div>
    <div id="general_bloc" :key="mapKey">
      <div class="col-7" v-show="affMenu" id="first_bloc">
        <div class="card mb-3">
          <div class="card-header text-white bg-secondary mb-2 py-2 px-3" id="temporal_bloc">
            <h5>Temporal filters</h5>
            <button @click="affTempo = !affTempo" class="btn btn-primary menu_button">
              {{ affTempo ? "&#11165;" : "&#11167;" }}
            </button>
          </div>
          <div class="card-body pb-4" v-show="affTempo">
            <div class="info">
              <div v-if="anneeInvalide" class="validation">
                Years should be comprised between 1855 and 2000
              </div>
              <div v-if="periodeInverse" class="validation">
                Beginning year must be lower or equal to the end year of the period
              </div>
            </div>

            <div class="row">
              <div class="row mb-3">
                <div class="col-md-7">
                  <div class="row">
                    <label for="year" class="form-label col-6 col-form-label text-end">Year</label>
                    <div class="col-5">
                      <input v-model="year" id="year" type="text" class="form-control" @focus="anneeInvalide = true"
                        @blur="anneeInvalide = false" :disabled="choixPeriode" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-7">
                  <div class="row">
                    <label for="period_first" class="form-label col-6 col-form-label text-end">Period from</label>
                    <div class="col-5">
                      <input v-model="period_first" id="period_first" type="text" class="form-control"
                        :disabled="choixAnnee" @focus="anneeInvalide = true" @blur="anneeInvalide = false" />
                    </div>
                  </div>
                </div>
                <div class="col-5">
                  <div class="row">
                    <label for="temporal" class="form-label col-6 col-form-label text-end">To</label>
                    <div class="col-5">
                      <input v-model="period_second" id="period_second" type="text" class="form-control"
                        :disabled="choixAnnee" @focus="anneeInvalide = true" @blur="anneeInvalide = false" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card mb-3">
          <div class="card-header text-white bg-secondary mb-2 py-2 px-3" id="spatial_bloc">
            <h5>Spatial filters</h5>
            <button @click="affSpatial = !affSpatial" class="btn btn-primary menu_button">
              {{ affSpatial ? "&#11165;" : "&#11167;" }}
            </button>
          </div>
          <div class="card-body pb-4" v-show="affSpatial">
            <div class="row">
              <!-- <div class="row mb-3">
                <div class="col-12">
                  <div class="row">
                <label for="country" class="form-label col-4 col-form-label text-end">Country</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_country_list" :items="myUseStore.menu_country_list" />
                </div>
                </div>
                </div>
              </div> -->
              <div class="row mb-3">
                <!-- <div class="col-10">
                  <div class="row"> -->
                <label for="departement" class="form-label col-4 col-form-label text-end">Department</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_departement_list" :items="myUseStore.menu_departement_list" />
                </div>
                <!-- </div>
                </div> -->
              </div>
              <div class="row">
                <!-- <div class="col-10">
                  <div class="row"> -->
                <label for="city" class="form-label col-4 col-form-label text-end">City</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_city_list" :items="myUseStore.menu_city_list" />
                </div>
                <!-- </div>
                </div> -->
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-3">
          <div class="card-header text-white bg-secondary mb-2 py-2 px-3" id="familial_bloc">
            <h5>Familial trajectory</h5>
            <button @click="affFamilial = !affFamilial" class="btn btn-primary menu_button">
              {{ affFamilial ? "&#11165;" : "&#11167;" }}
            </button>
          </div>
          <div class="card-body pb-4" v-show="affFamilial">
            <div class="row mb-5">
              <div class="row mb-3">
                <!-- <div class="col-10">
                  <div class="row"> -->
                <label for="familial" class="form-label col-4 col-form-label text-end">Number of children</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_number_of_children" :items="myUseStore.menu_number_of_children" />
                  <!-- </div>
                  </div> -->
                </div>
              </div>
              <div class="row mb-3">
                <!-- <div class="col-10">
                  <div class="row"> -->
                <label for="familial" class="form-label col-4 col-form-label text-end">Number of parents</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_number_of_parents" :items="myUseStore.menu_number_of_parents" />
                  <!-- </div>
                  </div> -->
                </div>
              </div>
              <div class="row">
                <!-- <div class="col-10">
                  <div class="row"> -->
                <label for="familial" class="form-label col-4 col-form-label text-end">Status</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_marital_status" :items="myUseStore.menu_marital_status" />
                </div>
                <!-- </div>
                </div> -->
              </div>
            </div>

            <div class="checkboxes d-flex justify-content-between" id="family_members">
              <div class="col-4" style="width: calc(33.33% - 20px)" id="enfant">
                <h4>Children</h4>
                <div>
                  <input id="birth_children" class="checkboxes" type="checkbox" name="birth_children" checked />
                  <label for="birth">Birth</label>
                </div>

                <div>
                  <input id="work_children" class="checkboxes" type="checkbox" name="work_children" checked />
                  <label for="work">Work</label>
                </div>
                <div>
                  <input class="checkboxes" type="checkbox" id="res_children" name="res_children" checked />
                  <label for="children_home">Home</label><br />
                </div>
                <div class="row">
                  <label for="enfant" class="form-label col-6 col-form-label">
                    Rank
                  </label>
                  <div>
                    <CheckBoxItem v-if="myUseStore.menu_children_rank" :items="myUseStore.menu_children_rank" />
                  </div>

                  <br />
                </div>
              </div>
              <div class="col-4" style="width: calc(33.33% - 20px)" id="partner">
                <h4>Partner</h4>
                <div>
                  <input class="checkboxes" type="checkbox" name="partner_birth" id="partner_birth" checked />
                  <label for="partner_birth">Birth</label>
                </div>

                <div>
                  <input class="checkboxes" type="checkbox" id="partner_work" name="partner_work" checked />
                  <label for="partner_work">Work</label>
                </div>
                <div>
                  <input class="checkboxes" type="checkbox" id="partner_home" name="partner_home" checked />
                  <label for="partner_home">Home</label><br />
                </div>
              </div>
              <div class="col-4" style="width: calc(33.33% - 20px)" id="parent">
                <h4>Parents</h4>
                <div>
                  <input class="checkboxes" type="checkbox" id="birth_parent" name="birth_parent" checked />
                  <label for="birth">Birth</label>
                </div>
                <div>
                  <input class="checkboxes" type="checkbox" id="work_parent" name="work_parent" checked />
                  <label for="work">Work</label>
                </div>
                <div>
                  <input class="checkboxes" type="checkbox" id="parent_home" name="parent_home" checked />
                  <label for="parent_home">Home</label><br />
                </div>
                <div>
                  <input class="checkboxes" type="checkbox" id="parent_death" name="parent_death" checked />
                  <label for="parent_death">Death</label><br />
                </div>
                <div class="row mt-3">
                  <label for="spatial" class="form-label col-6 col-form-label">
                    Rank
                  </label>
                  <div class="">
                    <CheckBoxItem v-if="myUseStore.menu_parent_rank" :items="myUseStore.menu_parent_rank" />
                  </div>
                  <br />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-3" id="residential_bloc">
          <div class="card-header text-white bg-secondary mb-2 py-2 px-3">
            <h5>Residential trajectory</h5>
            <button @click="affResi = !affResi" class="btn btn-primary menu_button">
              {{ affResi ? "&#11165;" : "&#11167;" }}
            </button>
          </div>
          <div class="card-body pb-4" v-show="affResi">
            <div class="row mb-3">
              <div class="row">
                <label for="residential" class="form-label col-4 col-form-label text-end">Rank</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_residential_rank" :items="myUseStore.menu_residential_rank" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card mb-3" id="professionnal_bloc">
          <div class="card-header text-white bg-secondary mb-2 py-2 px-3">
            <h5>Professionnal trajectory</h5>
            <button @click="affPro = !affPro" class="btn btn-primary menu_button">
              {{ affPro ? "&#11165;" : "&#11167;" }}
            </button>
          </div>
          <div class="card-body pb-4" v-show="affPro">
            <div class="row">
              <div class="row mb-3">
                <label for="professionnal" class="form-label col-4 col-form-label text-end">Activity</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_professional_activity"
                    :items="myUseStore.menu_professional_activity" />
                </div>
              </div>
            </div>
            <div class="row">
              <div class="row mb-3">
                <label for="spatial" class="form-label col-4 col-form-label text-end">Rank</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_professional_rank" :items="myUseStore.menu_professional_rank" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header text-white bg-secondary mb-2 py-2 px-3">
            <h5>Leisure trajectory</h5>
            <button @click="affLeisure = !affLeisure" class="btn btn-primary menu_button">
              {{ affLeisure ? "&#11165;" : "&#11167;" }}
            </button>
          </div>
          <div class="card-body pb-4" v-show="affLeisure">
            <div class="row mb-3">
              <div class="row">
                <label for="spatial" class="form-label col-4 col-form-label text-end">Rank</label>
                <div class="col-7">
                  <CheckBoxItem v-if="myUseStore.menu_leisure_rank" :items="myUseStore.menu_leisure_rank" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div id="second_bloc">
        <!-- <div class="card mb-3"> -->
        <div class="card-header text-white bg-secondary mb-2 py-2 px-3">
          <h5>Spatial vizualisation</h5>
        </div>

        <div id="map_container" :key="mapKey">
          <MapContainer />
        </div>

        <br />
        <!-- </div> -->
        <div class="card">
          <div class="card-header text-white bg-secondary mb-2 py-2 px-3">
            <h5>
              Life trajectory of individual {{ myUseStore.individual_number }}
            </h5>
          </div>
          <Ligne :dateBegEpisodeSelected="dateBegEpisodeSelected" :dateEndEpisodeSelected="dateEndEpisodeSelected" />
        </div>
      </div>
    </div>
  </main>
</template>

<style>
#container {
  margin-left: 5vh;
  margin-right: 5vh;
}

#fillButton {
  border-radius: 0.5rem;
  box-sizing: border-box;
  font-size: 16px;
  justify-content: center;
  padding: 1rem 1.75rem;
  margin-right: 5px;
}

#map_container {
  background-color: rgb(50, 60, 84);
  padding: 1%;
  border-radius: 2%;
  width: 100%;
  height: 100%;
}

#general_bloc {
  display: flex;
}

#first_bloc {
  width: 50%;
}

.requestButton {
  background-image: linear-gradient(-180deg, #37aee2 0%, #1e96c8 100%);
  border-radius: 0.5rem;
  box-sizing: border-box;
  color: #ffffff;
  font-size: 16px;
  justify-content: center;
  padding: 1rem 1.75rem;
  cursor: pointer;
  margin-right: 5px;
}

#second_bloc {
  margin-left: 5px;
  width: 100%;
  height: 75vh;
}

label {
  display: inline-block;
  width: auto;
}

select {
  padding: 5px 10px;
}

.validation {
  border: 1px solid;
  margin: 10px 0px;
  padding: 15px 10px 15px 50px;
  background-repeat: no-repeat;
  background-position: 10px center;
}

.validation {
  color: #d63301;
  background-color: #ffccba;
  background-image: url("https://i.imgur.com/GnyDvKN.png");
}

.menu_button {
  float: right;
  background-color: grey;
  border-color: grey;
}

.checkboxes {
  margin-right: 0.5vh;
}
</style>
