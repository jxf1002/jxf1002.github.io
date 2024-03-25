<script setup>
useSeoMeta({
  title: '大学排行榜-数据-贾师傅的小站',
  description: '提供基于2023年校友会、软科、武书连数据的中国大学排行榜。',
  keywords: '贾师傅,大学排行榜,大学排行榜数据',
})

const { isMobile } = useDevice()

const { q, columns, mobileColumns, rows, page, pageCount, total, sort } = useCollege()

const cols = ref([])
if (isMobile) {
  cols.value = mobileColumns
} else {
  cols.value = columns
}
</script>

<template>
  <div class="mx-auto text-center md:px-24">
    <UCard class="w-full my-4" :ui="{
      divide: 'divide-y divide-gray-200 dark:divide-gray-700',
      header: { padding: 'px-4 py-5' },
      body: { padding: '', base: 'divide-y divide-gray-200 dark:divide-gray-700' },
      footer: { padding: 'p-4' }
    }">
      <template #header>
        <h1 class="mx-auto text-[40px] bold">大学排行榜</h1>
        <p class="mx-auto text-[14px] mt-[10px] text-gray-500">（基于2023年数据制作，使用3个排行榜平均值排名）</p>
      </template>
      <div class="flex px-3 py-3.5">
        <UInput v-model="q" placeholder="请输入大学名称" class="w-full md:w-auto" />
      </div>
      <UTable :columns="cols" :rows="rows" :ui="{ td: { base: 'whitespace-normal' } }" @update:sort="sort"
        sort-mode="manual" />
      <template #footer>
        <UPagination class="justify-center" size="lg" v-model="page" :page-count="pageCount" :total="total" />
      </template>
    </UCard>
  </div>
</template>