<template>
  <div id="chart">
    <apexchart height="350" :options="chartOptions" :series="series"></apexchart>
    <div class="info">Holes in the trajectories mean that there is either no data or no time data on this period</div>
  </div>
</template>

<script>
import VueApexCharts from "vue3-apexcharts";
import pinia from "@/store.js";
import { useDataStore } from "../stores/DataStore";
const myUseStore = useDataStore(pinia);

//Styles that will be used to change the color of the highlight
const styleFill = {
  residential: '#275016',
  professional: '#04467b',
  familial: '#ff1744'
};

export default ({
  computed: {

    /**
     * Value computed when the data of the person changes in the store
     * It will be filled with data used to display the life lines of the person
     */
    series() {
      //We compute only if there is data about a person
      if (myUseStore.info !== {}) {
        let lines = []; //The array that will be returned with data
        let rawData = myUseStore.info; //We get the data

        //We go through all the 4 traj and the nodes until we arrive at a leaf
        for (const trajectory in rawData) {

          //Nodes event or episode
          for (const type in rawData[trajectory]) {

            //In the lines, we do not display the relatives
            if (type !== "parents" && type !== "children" && type !== "partner") {

              //Object tu put in the array lines, the name is built with the traversed nodes and the data value contains the episode/event
              let res = {
                name: `${trajectory}`.charAt(0).toUpperCase() + `${trajectory}`.slice(1) + " " + `${type}`,
                data: []
              };

              for (const el in rawData[trajectory][type]) {

                let data = rawData[trajectory][type][el]; //e get the leaf data
                let lineElement; //This object will be filed by the process

                //If this is an event, start date = end date
                if (type === "event") {
                  lineElement = {
                    x: `${trajectory}`.charAt(0).toUpperCase() + `${trajectory}`.slice(1),
                    y: [
                      new Date(data.annee, 1, 1).getTime(),
                      new Date(data.annee, 6, 31).getTime()
                    ],
                    popup: { data: data, trajectory: trajectory, type: type }
                  };
                } else { //If it is an episode, we need to put 2 different dates
                  lineElement = {
                    x: `${trajectory}`.charAt(0).toUpperCase() + `${trajectory}`.slice(1),
                    y: [
                      //The half-years here allow us to put an event and an episode on the same year with no overlapping
                      new Date(data.date_debut, 7, 1).getTime(),
                      new Date(data.date_fin, 12, 31).getTime()
                    ],
                    popup: { data: data, trajectory: trajectory, type: type }
                  };
                };

                //We push our new object with the others
                res.data.push(lineElement);
              };

              //We put all out data in the computed value
              lines.push(res);
            };
          };
        };

        return lines; //And we return it
      };
    },
    /**
     * Computed value that allows use to dynamically modify its content, essentially for the annotations
     */
    chartOptions() {
      return {
        chart: {
          height: 350,
          type: 'rangeBar',
        },
        plotOptions: {
          bar: {
            horizontal: true,
            barHeight: '50%',
            rangeBarGroupRows: true
          }
        },
        colors: [
          //Colors corresponding to lines : it has to be in the order of apparition
          /* Résidential en vert (clair en premier pour les episodes et en foncé pour les evenements )*/
          "#ccff90", "#33691e",
          /* Familial en rose */
          "#ff99ff", "#ff1744",
          // //Enfants
          // "#8600b3",
          // //Parents en noir
          // "#000000",
          // //Conjoint
          // "#990000",
          /* Professionnel en bleu */
          "#49b0ff", "#0663af",
          /* Voyage en jaune */
          "#fff176", "#f9a825",
        ],
        fill: {
          type: 'solid'
        },
        xaxis: {
          type: 'datetime' // ligne de temps
        },
        legend: {
          position: 'right' // legende a droite
        },
        tooltip: {
          //Here is the creation of a popup when we hover over a line element
          custom: function (opts) {
            //Getting the data in the 'popup' value of the leaf pointed
            //Link stack to help : https://stackoverflow.com/questions/60074225/how-can-i-set-custom-tooltips-with-values-of-an-array-in-a-heatmap-apexchart
            let objetleaf = opts.ctx.w.config.series[opts.seriesIndex].data[opts.dataPointIndex].popup

            //We want the data + the traj because the data structure is not the same for each
            let trajectory = objetleaf.trajectory;
            let type = objetleaf.type;
            let data = objetleaf.data;

            //We separate between episode and events
            if (type === 'event') { //Event ; we can process all traj the same way

              //We just return an html list
              return ('<ul style="padding-right: 15px">' +
                '<li><b>Type </b>: ' + type + '</li>' +
                '<li><b>Year </b>: ' + data.annee + '</li>' +
                '<li><b>Event </b>: ' + data.type_event + '</li>' +
                '<li><b>Department </b>: ' + data.departement + '</li>' +
                '<li><b>City </b>: ' + data.commune + '</li>' +
                '</ul>');
            } else { //Episodes : we have to process the familial traj differently

              //Familial traj
              if (trajectory === 'familial') {
                return ('<ul style="padding-right: 15px">' +
                  '<li><b>Type </b>: ' + type + '</li>' +
                  '<li><b>From </b>: ' + data.date_debut + '</li>' +
                  '<li><b>To </b>: ' + data.date_fin + '</li>' +
                  '<li><b>Children </b>: ' + data.nbenfant + '</li>' +
                  '<li><b>Parents alive </b>: ' + data.nbparent + '</li>' +
                  '<li><b>Familial status </b>: ' + data.statut_matrimonial + '</li>' +
                  '</ul>');
              } else { //Other trajs
                return ('<ul style="padding-right: 15px">' +
                  '<li><b>Type </b>: ' + type + '</li>' +
                  '<li><b>From </b>: ' + data.date_debut + '</li>' +
                  '<li><b>To </b>: ' + data.date_fin + '</li>' +
                  '<li><b>Episode </b>: ' + data.type_episode + '</li>' +
                  '<li><b>Department </b>: ' + data.departement + '</li>' +
                  '<li><b>City </b>: ' + data.commune + '</li>' +
                  '</ul>');
              }
            };
          }
        },

        //This creates a highlight defined by the variables passed by the store with start and end date
        annotations: {
          xaxis: [{

            x: this.trajSelectedEpisode === 'familial' ? new Date(this.dateBegSelectedEpisode, 1, 1).getTime() : new Date(this.dateBegSelectedEpisode, 7, 1).getTime(),
            x2: this.trajSelectedEpisode === 'familial' ? new Date(this.dateEndSelectedEpisode, 7, 1).getTime() : new Date(this.dateEndSelectedEpisode, 12, 31).getTime(),
            borderColor: '#3832a8',
            fillColor: styleFill[this.trajSelectedEpisode],
          }]
        },
      }
    },

    //Variable that defines the start of the highlighted zone 
    dateBegSelectedEpisode() {
      return parseInt(myUseStore.dateBegSelectedEpisode, 10);
    },

    //Variable that defines the end of the highlighted zone 
    dateEndSelectedEpisode() {
      return parseInt(myUseStore.dateEndSelectedEpisode, 10);
    },

    //Variable that is used to change the color of the highlight
    trajSelectedEpisode() {
      return myUseStore.trajSelectedEpisode;
    }
  },
})
</script>

<!-- Scoped is for applying the styles only to this file-->
<style scoped>
.hori-timeline .events {
  border-top: 3px solid #e9ecef;
}

.hori-timeline .events .event-list {
  display: block;
  position: relative;
  text-align: center;
  padding-top: 70px;
  margin-right: 0;
}

.hori-timeline .events .event-list:before {
  content: "";
  position: absolute;
  height: 36px;
  border-right: 2px dashed #dee2e6;
  top: 0;
}

.hori-timeline .events .event-list .event-date {
  position: absolute;
  top: 38px;
  left: 0;
  right: 0;
  width: 75px;
  margin: 0 auto;
  border-radius: 4px;
  padding: 2px 4px;
}

@media (min-width: 1140px) {
  .hori-timeline .events .event-list {
    display: inline-block;
    width: 24%;
    padding-top: 45px;
  }

  .hori-timeline .events .event-list .event-date {
    top: -12px;
  }
}

.bg-soft-primary {
  background-color: rgba(64, 144, 203, .3) !important;
}

.bg-soft-success {
  background-color: rgba(71, 189, 154, .3) !important;
}

.bg-soft-danger {
  background-color: rgba(231, 76, 94, .3) !important;
}

.bg-soft-warning {
  background-color: rgba(249, 213, 112, .3) !important;
}

.card {
  border: none;
  margin-bottom: 24px;
  -webkit-box-shadow: 0 0 13px 0 rgba(236, 236, 241, .44);
  box-shadow: 0 0 13px 0 rgba(236, 236, 241, .44);
}

.map {
  height: 500px;
}

.info {
  font-style: italic;
  font-size: 15px;
  padding-right: 1vh;
  float: right;
}
</style>
