import * as Game from './game.js'
import * as UI from './ui.js'

let driverObj = null

function isCoarse() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
}

function isPortraitView() {
  return typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches
}

function exitTour() {
  driverObj = null
  Game.endDemo()
  UI.update()
}

export function startTour() {
  if (driverObj) return
  let factory = window.driver && window.driver.js && window.driver.js.driver
  if (!factory) return
  Game.startDemo()
  let steps = [
    {
      popover: {
        title: '欢迎来到麻将小课堂',
        description: '带你逛一逛牌桌，认认每个地方是干嘛的。眼前这桌是演示牌，随便看；想走随时点右上角 × 或按 ESC，一秒回大厅。'
      }
    },
    {
      element: '#pb',
      popover: {
        title: '这里坐的是你',
        description: '底下这一排是你的手牌，花色都分好组排得整整齐齐。轮到你出牌时，点一张就打出去了，不用拖来拖去。',
        side: 'top'
      }
    },
    {
      element: '#mb',
      popover: {
        title: '碰吃杠的牌放这儿',
        description: '从别人手里碰、吃、杠来的牌会摆在这里。对方打出的那张会标成黄色放在中间，一眼就能认出来。',
        side: 'top'
      }
    },
    {
      element: '.gi',
      popover: {
        title: '右上角工具箱',
        description: '📖 规则随时翻，📜 日志能回看大家出过什么。「回主页面」是中场休息按钮，牌会自动存好，下次点继续游戏接着打。牌墙还剩几张，这里也看得到。',
        side: 'bottom'
      }
    },
    {
      element: '#auto-btn',
      popover: {
        title: '走开就点托管',
        description: '有事要离开？点一下托管，电脑帮你接着打，回来再点一下就拿回来，一秒不耽误。',
        side: 'bottom'
      }
    },
    {
      element: '.center',
      popover: {
        title: '中间看两件事',
        description: '四家打出来的牌都摊在中间，最新打出的那张会亮一下。别人刚打出的牌还会放大给你看，方便你决定碰不碰。'
      }
    },
    {
      element: '#ab2',
      popover: {
        title: '该你拿主意时看这里',
        description: '比如现在：上家打出的这张你能碰，「碰」「过」就跳出来了。真玩时想要就点碰，不想要就点过。演示桌里按钮按不动，放心看。',
        side: 'top'
      }
    },
    {
      element: '#pt',
      popover: {
        title: '抬头看看对手',
        description: '上面三家是电脑。名字旁边是分数，头顶 🎲 的是庄家。谁头上冒出「听牌」，就是只差一张了，出牌可得留点神。',
        side: 'bottom'
      }
    },
    {
      popover: {
        title: '逛完啦，去开一桌吧',
        description: '记住三件事：盯紧自己的手牌，该拿主意时别犹豫，有人听牌就收着点打。祝把把自摸！'
      }
    }
  ]
  // 触屏竖拿手机才讲横屏：只用嘴讲，不真转（转屏会转跑 driver 的浮层，直接玩时再试）
  if (isCoarse() && isPortraitView()) {
    steps.splice(steps.length - 1, 0, {
      element: '#orient-btn',
      popover: {
        title: '竖着玩，横屏也行',
        description: '「切换横屏」是手机专属：竖屏单手点得顺，横屏整张桌子看得全。开一局后亲手点它试试，随时都能切回来。',
        side: 'bottom'
      }
    })
  }
  driverObj = factory({
    animate: true,
    allowClose: true,
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '开玩',
    popoverClass: 'mj-tour',
    disableActiveInteraction: true,
    steps,
    onDestroyed: () => exitTour()
  })
  driverObj.drive()
}
