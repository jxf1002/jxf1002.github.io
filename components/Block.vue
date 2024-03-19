<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  data: {
    type: Array,
    required: true
  }
})
</script>

<template>
  <div class="bg-white p-4">
    <h2 class="text-purple-700 font-bold text-[18px] mb-[5px]">{{ title }}</h2>
    <div class="grid grid-cols-4 gap-4">
      <div class="text-sm leading-6" v-for="item in data" :key="item.id">
        <NuxtLink :to="item.route">
          <UCard class="bg-gray-50 hover:bg-gray-100">
            <template #header>
              <p class="text-xl bold">{{ item.title }}</p>
            </template>
            <p>{{ item.description }}</p>
          </UCard>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>