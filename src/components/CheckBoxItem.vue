<!-- Component that is used to display a rolling down menu with checkboxes when the user clicks on it in the query filter -->

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import Checkbox from "./checkbox.vue";
import { useDataStore } from "../stores/DataStore";
const store = useDataStore();

//Props récupérés du composant parent
const props = defineProps({
  items: Object
});

let show = true;

//Booleen qui sert à afficher/ne pas afficher les checkboxes
const displayAll = ref(true);

/** 
 * Function that gets the $ emit from the child component (checkbox) and adds it to the array with the parameters
 * If the user selects 'Select all', the array is filled with all the child data
 * 
 * @param {*} payload le contenu du $emit du composant enfant
 */
function buildParams(payload) {

  //Si la case qui est cochée est celle de sélection de toutes les cases
  if (payload.label === "Select all") {

    if (payload.value === true) { //Si la case est cochée
      //On remplit le tableau de conditions avec le contenu des éléments enfants
      for (enfant in props.items.list) { //On parcourt le props passé qui contient tous les paramètres
        store[props.items.label].push(enfant.message); //Et on ajoute le contenu de chacun à notre tableau
      }

      displayAll.value = !displayAll.value; //On cache les autres cases

    } else { //Si la case est décochée
      displayAll.value = !displayAll.value; //On affiche de nouveau les cases qui étaient cachées
    }

  } else { //Si l'évènement est envoyé par une checkbox autre que "select all"
    if (props.items.label === 'dpt') { //Si on est dans le component des départements

      if (payload.value) {  //Si la case vient d'être cochée
        store[props.items.label].push(payload.num) //On ajoute le numéro au tableau

      } else { //La case vient d'être décochée, on doit enlever le numéro 
        //On retire l'élement du tableau
        let i = store[props.items.label].indexOf(payload.num);
        store[props.items.label].splice(i, 1);
      };

    } else { //Dans le cas où le component est un autre que celui des départements
      //On va chercher à stocker des strings

      if (payload.value) { //Case cochée
        store[props.items.label].push(payload.label) //On ajoute l'élément au tableau
      } else { //Case décochée
        //On retire l'élément
        let i = store[props.items.label].indexOf(payload.label);
        store[props.items.label].splice(i, 1);
      }
    }
  }
};

/**
 * Function that displays the rolling down menu when the used clicks on it
 */
function showCheckboxes(parameter) {
  var checkboxes = document.getElementsByClassName("selector");

  if (show) {
    checkboxes[props.items.list[parameter].ref].style.display = "block";
    show = false;
  } else {
    checkboxes[props.items.list[parameter].ref].style.display = "none";
    show = true;
  }
}
</script>

<template>
  <form>
    <div class="multipleSelection">
      <div class="selectBox" @click="showCheckboxes(0)">
        <select>
          <option>Select options</option>
        </select>
        <div class="overSelect"></div>
      </div>
      <div id="1" class="selector">
        <Checkbox :label="'Select all'" @checked="buildParams">
        </Checkbox>

        <!-- This div disappears when the user selects "Select all" -->
        <div v-if="displayAll">
          <Checkbox v-for="item in items.list" :key="item.id" :label="item.message" :id="item.id" :fieldId="item.id" @checked="buildParams">
          </Checkbox>
        </div>
      </div>
    </div>
  </form>
</template>



<style>
.multipleSelection {
  background-color: #bcc2c1;
}

.selectBox {
  position: relative;
}

.selectBox select {
  width: 100%;
  font-weight: bold;
}

.overSelect {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}

.selector {
  display: none;
  border: 1px #8df5e4 solid;
}

.selector label {
  display: block;
}

#checkBoxes label:hover {
  background-color: #4f615e;
}
</style>
