<!-- Component that represents one episode in the popup displayed on the map -->
<template>
    <div class="bloc">
        <div :class="(parseInt(clickRank, 10) === parseInt(rang, 10) && clickTraj === traj) ? 'focus' : ''">
            <h6>{{ traj[0].toUpperCase() + traj.substring(1) }} episode {{ traj === 'familial' ? '' : '#' + rang }}</h6>
            <div v-html="message"></div>
        </div>
        <div v-if="traj === 'residential' || traj === 'professional'">
            <button v-if="rang !== '1' || !isPension" @click="displayLine(false)">See previous episode</button>
            <button v-if="!isPension" @click="displayLine(true)">See next episode</button>
        </div>
            <button v-if="!isPension" @click="displayLifeTrajectory">Vizualize on life trajectory</button>
    </div>
</template>

<script>
import pinia from "@/store.js";
import { useDataStore } from "../stores/DataStore";
const myUseStore = useDataStore(pinia);
export default {
    props: {
        id: Number,
        traj: String,
        message: String,
        rang: String,
        clickRank: String,
        clickTraj: String,
        dateBeg: String,
        dateEnd: String
    },
    methods: {
        /**
         * Emits an event that gives the trajectory, the rank, and the indiciation if the user asked for the next or the previous episode
         * It will be used to get to the episode asked by the user
         */
        displayLine(next) {
            this.$emit('nextLine', { traj: this.traj, rang: this.rang, next: next });
        },

        /**
         * Gives the data to the lines when the user clicks on the 'vizualize' button in the popup
         */
        displayLifeTrajectory() {
            myUseStore.dateBegSelectedEpisode = this.dateBeg;
            myUseStore.dateEndSelectedEpisode = this.dateEnd;
            myUseStore.trajSelectedEpisode = this.traj;
        }
    },
    computed: {
        /**
         * Checks if the episode is of type 'pension' to not display the buttons
         */
        isPension() {
            if (this.traj === 'residential') { //Pension is only in residential events
                //TODO: check if this might be a problem if a city name contains the term 'Pension'
                return this.message.includes('Pension'); //We return the result of this check
            };

            return false; 
        },

        isSelectedEpisode() { //Here we check if the component is the one aimed at by the 'next episode' button
            if ((parseInt(this.clickRank, 10) === parseInt(this.rang, 10) && this.clickTraj === this.traj)) {
                return true;
            } else {
                return false;
            };
        }
    },

    watch: {
        isSelectedEpisode() { //And depending on the value returned here, we send the dates to the store to display it in the lines
            if (this.isSelectedEpisode === true) {
                myUseStore.dateBegSelectedEpisode = this.dateBeg;
                myUseStore.dateEndSelectedEpisode = this.dateEnd;
                myUseStore.trajSelectedEpisode = this.traj;
            };
        },
    },
};
</script>

<style>
h6 {
    font-weight: bold;
}

ul {
    margin-bottom: 4px;
}

.bloc {
    margin-bottom: 3%;
}

.focus {
    color: red
}
</style>