<script setup>
import IndividualItem from "./IndividualItem.vue";
import HomeVue from "./Home.vue";
import { ref } from "vue";
const affIndividual = ref(true);
const affHome = ref(false);
const page = "";
</script>

<template>
  <header>
    <div id="header">
      <!-- TODO: use routers instead of v-on ? -->
      <button class="navbar-toggler">SLT</button>
      <button @click="affHome = !affHome; affIndividual = !affIndividual" class="navbar-toggler">Home</button>
      <button @click="affIndividual = !affIndividual; affHome = !affHome " class="navbar-toggler">Individual</button>
      <button class="navbar-toggler">Group</button>
      <button class="navbar-toggler">Metadata</button>
      <button class="navbar-toggler">?</button>
    </div>
  </header>
  <main v-show="affHome">
    <HomeVue />
  </main>
  <main v-show="affIndividual">
    <IndividualItem />
  </main>
</template>

<style scoped>
#header {
  background-color: rgb(50, 60, 84);
  width: 100%;
  padding: 10px;
  margin: 0 auto;
}

button {
  font-size: 30px;
  font-weight: bold;
  color: white;
  margin: 10px 0;
  padding: 10px;
  width: 16.33%;
}

main {
  margin: 2%
}
</style>
