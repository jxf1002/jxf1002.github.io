<script setup>
const { q, columns, colleges, sort } = useCollege()
</script>

<template>
  <div class="w-[800px] mx-auto text-center">
    <h1 class="mx-auto text-[40px] bold mt-[20px]">大学排行榜</h1>
    <div class="flex px-3 py-3.5 border-b border-gray-200 dark:border-gray-700">
      <UInput v-model="q" placeholder="请输入大学名称" />
    </div>
    <UTable :columns="columns" :rows="colleges" :sort="sort" />
  </div>
</template>