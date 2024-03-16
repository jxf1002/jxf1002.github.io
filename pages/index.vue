<script setup>
const data = [
  {
    id: 1,
    title: '数据1',
    description: '这是数据1的描述'
  },
  {
    id: 2,
    title: '数据2',
    description: '这是数据2的描述'
  }
]
const tools = [
  {
    id: 1,
    title: '工具1',
    description: '这是工具1的描述'
  },
  {
    id: 2,
    title: '工具2',
    description: '这是工具2的描述'
  }
]
</script>

<template>
  <div class="bg-purple-500">
    <div class="bg-purple-700 py-4">
      <h1 class="text-center text-white">首页</h1>
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-white p-4">
        <h2 class="text-purple-700">数据</h2>
        <ul>
          <li v-for="item in data" :key="item.id">
            <Card :data="data" />
          </li>
        </ul>
      </div>
      <div class="bg-white p-4">
        <h2 class="text-purple-700">工具</h2>
        <ul>
          <li v-for="tool in tools" :key="tool.id">
            <Card :data="tool" />
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
