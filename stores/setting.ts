import { defineStore } from "pinia"

export const useSettingStore = defineStore("counter", {
  state: () => {
    return { count: 0 }
  },
  actions: {
    increment() {
      this.count++
    },
  },
})
