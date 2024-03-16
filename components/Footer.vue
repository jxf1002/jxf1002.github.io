<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <footer class="bg-gradient-to-r from-purple-500 to-purple-700 h-[30px] flex items-center justify-center text-white">
    <p>Copyright © {{ year }} justful.cn版权所有
      <a href="https://beian.miit.gov.cn/" target="_blank">京ICP备18007833号-1</a>
    </p>
  </footer>
</template>