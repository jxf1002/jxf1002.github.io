<template>
  <div class="card">
    <div class="card-header">
      <img :src="imageSrc" alt="Card Image" class="card-image" :class="cardImageClass">
      <h2 class="card-title" :class="cardTitleClass">{{ title }}</h2>
    </div>
    <div class="card-body">
      <p class="card-description" :class="cardDescriptionClass">{{ description }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Card',
  props: {
    imageSrc: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    }
  },
  computed: {
    cardImageClass() {
      return 'w-full h-200 object-cover rounded-t-lg transition-transform duration-300 ease-in-out hover:scale-105';
    },
    cardTitleClass() {
      return 'mt-16 text-2xl font-bold';
    },
    cardDescriptionClass() {
      return 'text-gray-600 text-sm';
    }
  }
}
</script>
