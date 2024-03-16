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
        <figure
          class="relative flex flex-col-reverse bg-slate-50 rounded-lg p-6 dark:bg-slate-800 dark:highlight-white/5">
          <blockquote class="mt-6 text-slate-700 dark:text-slate-300">
            <p>{{ item.description }}</p>
          </blockquote>
          <figcaption class="flex items-center space-x-4">
            <div class="flex-auto">
              <div class="text-base text-slate-900 font-semibold dark:text-slate-300">
                <span class="absolute inset-0"></span>{{ item.title }}
              </div>
            </div>
          </figcaption>
        </figure>
      </div>
    </div>
  </div>
</template>