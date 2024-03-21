<script setup>
useSeoMeta({
  title: '5A级旅游景区-数据-贾师傅的小站',
  description: '提供基于2023年数据的5A级旅游景区。',
  keywords: '贾师傅,5A级旅游景区,5A级旅游景区数据',
})

const { isMobile } = useDevice()

const { columns, mobileColumns, data, p, q, provinces } = useTourism()

const cols = ref([])
if (isMobile) {
  cols.value = mobileColumns
} else {
  cols.value = columns
}
</script>

<template>
  <div class="mx-auto text-center md:px-24">
    <h1 class="mx-auto text-[40px] bold pt-[20px]">5A级旅游景区</h1>
    <p class="mx-auto text-[14px] mt-[10px] text-gray-500">（基于2023年数据制作）</p>
    <div class="flex px-3 py-3.5 border-b border-gray-200 dark:border-gray-700">
      <UInput v-model="q" placeholder="请输入景点名称" class="w-full md:w-60" />
      <USelectMenu v-model="p" placeholder="请选择地区" :options="provinces" class="ml-[20px] w-full md:w-60" />
    </div>
    <UTable class="p-4" :columns="cols" :rows="data" />
    {{ isMobile }}
  </div>
</template>