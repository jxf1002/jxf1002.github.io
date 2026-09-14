;(function () {
  "use strict"

  var range = document.querySelector("[data-speed-range]")
  var speeds = document.querySelectorAll("[data-speed]")
  var app = document.querySelector(".app")
  var startButton = document.querySelector("[data-start]")
  var finishButton = document.querySelector("[data-finish]")
  var timer = document.querySelector("[data-timer]")
  var report = document.querySelector("[data-report]")
  var reportTime = document.querySelector("[data-report-time]")
  var reportSpeed = document.querySelector("[data-report-speed]")
  var reportDistance = document.querySelector("[data-report-distance]")
  var reportCalories = document.querySelector("[data-report-calories]")
  var reportHeartRate = document.querySelector("[data-report-heart-rate]")
  var reportPace = document.querySelector("[data-report-pace]")
  var reportNote = document.querySelector("[data-report-note]")
  var startedAt = 0
  var timerId = null

  function updateSpeed() {
    var speed = Number(range.value)
    var progress =
      ((speed - Number(range.min)) /
        (Number(range.max) - Number(range.min))) *
      100
    var duration = 1.05 - (speed / Number(range.max)) * 0.88
    document.documentElement.style.setProperty(
      "--runner-duration",
      duration.toFixed(2) + "s",
    )
    range.style.background =
      "linear-gradient(90deg, var(--blue) 0 " +
      progress +
      "%, #dbe6e7 " +
      progress +
      "% 100%)"
    speeds.forEach(function (item) {
      item.textContent = speed
    })
  }

  range.addEventListener("input", updateSpeed)
  updateSpeed()

  function formatTime(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0")
    var seconds = (totalSeconds % 60).toString().padStart(2, "0")
    return minutes + ":" + seconds
  }

  function updateTimer() {
    timer.textContent = formatTime(
      Math.floor((Date.now() - startedAt) / 1000),
    )
  }

  startButton.addEventListener("click", function () {
    startedAt = Date.now()
    timerId = setInterval(updateTimer, 1000)
    updateTimer()
    app.classList.remove("is-paused")
    report.classList.remove("visible")
    startButton.disabled = true
    finishButton.disabled = false
  })

  finishButton.addEventListener("click", function () {
    var elapsedSeconds = Math.max(
      1,
      Math.floor((Date.now() - startedAt) / 1000),
    )
    var speed = Number(range.value)
    var distance = (speed * elapsedSeconds) / 3600
    var minutes = elapsedSeconds / 60
    var calories = distance * 60
    var heartRate = Math.min(190, Math.round(108 + speed * 3.8))
    var paceMinutes = 60 / speed
    var paceWholeMinutes = Math.floor(paceMinutes)
    var paceSeconds = Math.round((paceMinutes - paceWholeMinutes) * 60)
      .toString()
      .padStart(2, "0")
    clearInterval(timerId)
    timerId = null
    updateTimer()
    app.classList.add("is-paused")
    startButton.disabled = false
    finishButton.disabled = true
    reportTime.textContent =
      minutes < 1 ? elapsedSeconds + " 秒" : minutes.toFixed(1) + " 分钟"
    reportSpeed.textContent = speed + " km/h"
    reportDistance.textContent = distance.toFixed(2) + " km"
    reportCalories.textContent = Math.round(calories) + " kcal"
    reportHeartRate.textContent = heartRate + " bpm"
    reportPace.textContent = paceWholeMinutes + ":" + paceSeconds + " /km"
    reportNote.textContent =
      minutes >= 20
        ? "耐力协议完成，今天的你很强。卡路里按 60kg 体重模型估算。"
        : minutes >= 5
          ? "节奏稳定，继续保持这份能量。卡路里按 60kg 体重模型估算。"
          : "短时冲刺完成，下一次再多跑一点。卡路里按 60kg 体重模型估算。"
    report.classList.add("visible")
  })
})()
