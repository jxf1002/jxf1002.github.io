<script setup>
useSeoMeta({
  title: '大学排行榜-数据-贾师傅的小站',
  description: '提供基于2023年校友会、软科、武书连数据的中国大学排行榜。',
  keywords: '贾师傅,大学排行榜,大学排行榜数据',
})

const { isMobile } = useDevice()

const { q, columns, mobileColumns, colleges } = useCollege()

const cols = ref([])
if (isMobile) {
  cols.value = mobileColumns
} else {
  cols.value = columns
}
</script>

<template>
  <div class="mx-auto text-center md:px-24">
    <h1 class="mx-auto text-[40px] bold pt-[20px]">大学排行榜</h1>
    <p class="mx-auto text-[14px] mt-[10px] text-gray-500">（基于2023年数据制作，使用3个排行榜平均值排名）</p>
    <div class="flex px-3 py-3.5 border-b border-gray-200 dark:border-gray-700">
      <UInput v-model="q" placeholder="请输入大学名称" class="w-full md:w-auto" />
    </div>
    <UTable class="p-4" :columns="cols" :rows="colleges" :ui="{ td: { base: 'whitespace-normal' } }" />
  </div>
</template>