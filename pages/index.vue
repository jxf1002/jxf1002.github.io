<script setup>
const { dataTypes, toolTypes } = useHome()
</script>

<template>
  <div>
    <section class="bg-white dark:bg-gray-900">
      <div class="grid max-w-screen-xl px-4 pt-20 pb-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12 lg:pt-24">
        <div class="mr-auto place-self-center lg:col-span-7">
          <h1
            class="max-w-2xl mb-4 text-4xl font-extrabold leading-none tracking-tight md:text-5xl xl:text-6xl dark:text-white">
            用代码创造无限可能</h1>
          <p class="max-w-2xl mb-6 font-light text-gray-500 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400">
            分享个人精心整理的实用工具和数据</p>
        </div>
        <div class="hidden lg:mt-0 lg:col-span-5 lg:flex">
          <img src="/images/banner.png" alt="banner">
        </div>
      </div>
    </section>
    <Block class="mt-4" title="数据" :data="dataTypes" />
    <Block class="mt-4" title="工具" :data="toolTypes" />
  </div>
</template>
