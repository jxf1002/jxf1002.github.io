<script setup>
useSeoMeta({
  title: '大学排行榜-数据-贾师傅的小站',
  description: '提供基于校友会、软科、武书连数据的中国大学排行榜。',
  keywords: '贾师傅,大学排行榜,大学排行榜数据',
})

const { isMobile } = useDevice()

const route = useRoute()
const year = parseInt(route.params.id)

const { q, columns, mobileColumns, rows, page, pageCount, total, sort } = useCollege(year)

const cols = ref([])
if (isMobile) {
  cols.value = mobileColumns
} else {
  cols.value = columns
}

const toYear = (year) => {
  const router = useRouter()
  router.push({ name: 'college-id', params: { id: year } })
}
</script>

<template>
  <div class="mx-auto text-center md:px-24 md:py-4">
    <UCard :ui="{
      base: 'w-full',
      divide: 'divide-y divide-gray-200 dark:divide-gray-700',
      rounded: 'rounded-none md:rounded-lg',
      header: { padding: 'px-4 py-5' },
      body: { padding: '', base: 'divide-y divide-gray-200 dark:divide-gray-700' },
      footer: { padding: 'p-4' }
    }">
      <template #header>
        <h1 class="mx-auto text-[40px] bold">大学排行榜</h1>
        <p class="mx-auto text-[14px] mt-[10px] mb-[5px] text-gray-500">（基于{{ year }}年数据制作，使用3个排行榜平均值排名）</p>
        <NuxtLink to="/college/2024/">
          <UButton label="2024年" :disabled="year === 2024" :color="year === 2024 ? 'gray' : 'purple'" />
        </NuxtLink>
        <NuxtLink to="/college/2023/">
          <UButton label="2023年" class="ml-[20px]" :disabled="year === 2023"
            :color="year === 2023 ? 'gray' : 'purple'" />
        </NuxtLink>
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