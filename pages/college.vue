<script setup>
useSeoMeta({
  title: '大学排行榜-数据-贾师傅的小站',
  description: '提供基于2023年校友会、软科、武书连数据的中国大学排行榜。',
  keywords: '贾师傅,大学排行榜,大学排行榜数据',
})

const { q, columns, colleges } = useCollege()
</script>

<template>
  <div class="w-[900px] mx-auto text-center">
    <h1 class="mx-auto text-[40px] bold pt-[20px]">大学排行榜</h1>
    <p class="mx-auto text-[14px] mt-[10px] text-gray-500">（基于2023年数据制作）</p>
    <div class="flex px-3 py-3.5 border-b border-gray-200 dark:border-gray-700">
      <UInput v-model="q" placeholder="请输入大学名称" />
    </div>
    <UTable :columns="columns" :rows="colleges" />
  </div>
</template>