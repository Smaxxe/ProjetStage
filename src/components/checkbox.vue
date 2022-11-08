<template>
  <label :for="fieldId" class="flex flex-row items-center font-bold cursor-pointer">
    <input type="checkbox" :id="fieldId" v-model="checked" class="mr-2" @click="onClick" />
    {{ label }}
  </label>
</template>
<script>
export default {
  props: {
    label: String,
    id: Number,
    fieldId: {
      type: Number,
      required: false,
    },

  },
  data: function () {
    return {
      checked: false
    }
  },
  methods: {
    /**
     * Au clic sur la box, on émet un évènement vers le composant parent avec les infos du composant cliqué
     */
    onClick() {
      //La valeur checked vaut l'état avant le clic, donc on émet son contraire pour avoir la bonne valeur
      this.$emit('checked', { 'label': this.label, 'num': this.id, 'value': !this.checked });
    },
  },
};
</script>
