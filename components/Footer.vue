<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <footer>
    <UDivider />
    <div class="flex items-center justify-center h-[30px] gap-2 text-[14px]">
      <p class="text-gray-500 dark:text-gray-400">Copyright © {{ year }} justful.cn版权所有</p>
    </div>
    <div class="flex items-center justify-center h-[30px] gap-2 text-[14px]">
      <a href="https://beian.miit.gov.cn/" target="_blank"
        class="text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400">京ICP备18007833号-1</a>
    </div>
  </footer>
</template>