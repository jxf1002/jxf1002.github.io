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
  <div class="px-4 md:px-20">
    <UDivider>
      <h2 class="text-purple-500 dark:text-purple-400 font-bold text-[18px] mb-[5px]">{{ title }}</h2>
    </UDivider>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="text-sm leading-6" v-for="item in data" :key="item.id">
        <NuxtLink :to="item.route">
          <UCard class="bg-gray-50 hover:bg-gray-100">
            <template #header>
              <p class="text-xl bold h-4">{{ item.title }}</p>
            </template>
            <p class="h-16">{{ item.description }}</p>
          </UCard>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>