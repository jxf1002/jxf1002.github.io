<template>
  <header
    class="flex items-center bg-background/75 backdrop-blur border-b -mb-px px-[20px] sticky top-0 z-50 border-gray-200 dark:border-gray-800">
    <div class="flex">
      <NuxtLink to="/">
        <p class="flex text-[24px] bold hover:text-purple-500 dark:hover:text-purple-400">贾师傅的小站</p>
      </NuxtLink>
    </div>
    <div class="flex justify-end flex-grow">
      <Mode />
    </div>
  </header>
</template>