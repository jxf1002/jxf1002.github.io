<script setup>
import { dataTypes, toolTypes } from '~/assets/data/home.js'
</script>

<template>
  <div class="h-[calc(100vh-80px)]">
    <div class="bg-gradient-to-r from-purple-500 to-purple-700 h-[200px]">
      <h1 class="text-center text-white pt-[40px] text-[40px] bold">用代码创造无限可能</h1>
      <p class="text-center text-white mt-[10px]">分享个人觉得有用的工具和数据</p>
    </div>
    <Block title="数据" :data="dataTypes" />
    <Block title="工具" :data="toolTypes" />
  </div>
</template>
